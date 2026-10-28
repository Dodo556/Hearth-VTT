fn folder_create(id: &str, name: &str, parent: Option<&str>) -> Value {
    json!({"type":"journal.folder.create","payload":{"folderId":id,"name":name,"parentId":parent}})
}
fn folder_update(id: &str, v: i64, name: &str, parent: Option<&str>) -> Value {
    json!({"type":"journal.folder.update","payload":{"folderId":id,"expectedVersion":v,"name":name,"parentId":parent}})
}
fn page_move(id: &str, v: i64, folder: Option<&str>) -> Value {
    json!({"type":"journal.move","payload":{"journalId":id,"expectedVersion":v,"folderId":folder}})
}
#[tokio::test]
async fn journal_folders_bound_hierarchy_keep_metadata_private_and_preserve_contents() {
    let h=Host::new().await;
    let owner=h.owner().await;
    let camp=h.campaign_id(&owner).await;
    let (alice,_)=h.player(&owner,&camp,"folder_alice").await;
    let server=LiveServer::start(&h).await;
    let mut dm=server.connect(&camp,&owner).await; frame(&mut dm).await;
    let mut a=server.connect(&camp,&alice).await; frame(&mut a).await;
    let ids:Vec<String>=(0..5).map(|_|uuid::Uuid::new_v4().to_string()).collect();
    let request=uuid::Uuid::new_v4().to_string();
    let create=folder_create(&ids[0],"SECRET_FOLDER",None);
    let ack=command(&mut dm,&request,0,create.clone()).await;
    assert_eq!(ack["kind"],"ack","{ack}");
    assert_eq!(command(&mut dm,&request,0,create).await["duplicate"],true);
    let mut rev=1;
    for n in 1..4 { accepted(&mut dm,&mut rev,folder_create(&ids[n],&format!("level{n}"),Some(&ids[n-1]))).await; }
    for cmd in [folder_create(&ids[4],"Too deep",Some(&ids[3])),folder_update(&ids[0],1,"cycle",Some(&ids[3])),folder_update(&ids[1],1,"self",Some(&ids[1])),folder_update(&ids[0],1,"deepen subtree",Some(&ids[1]))] {
      let failed=command(&mut dm,&uuid::Uuid::new_v4().to_string(),rev,cmd).await;
      assert_eq!(failed["kind"],"error","{failed}");
    }
    accepted(&mut dm,&mut rev,folder_create(&ids[4],"Other root",None)).await;
    let deep=command(&mut dm,&uuid::Uuid::new_v4().to_string(),rev,folder_update(&ids[0],1,"Deep subtree",Some(&ids[4]))).await;
    assert_eq!(deep["kind"],"error");
    let page=uuid::Uuid::new_v4().to_string();
    accepted(&mut dm,&mut rev,journal_create(&page,"Clue","LITERAL_SHARED_BODY")).await;
    accepted(&mut dm,&mut rev,journal_update(&page,1,"shared","LITERAL_SHARED_BODY")).await;
    accepted(&mut dm,&mut rev,page_move(&page,2,Some(&ids[0]))).await;
    let snapshot=through(&mut a,rev).await;
    assert!(snapshot.get("journalFolders").is_none());
    assert!(!snapshot.to_string().contains("SECRET_FOLDER"));
    assert!(!snapshot.to_string().contains(&ids[0]));
    let (_,rest,_)=h.request("GET",&format!("/api/campaigns/{camp}/journals"),json!({}),Some(&alice)).await;
    assert!(rest.get("folders").is_none());
    assert!(rest["journals"].as_array().unwrap().iter().all(|j|j.get("folderId").is_none()));
    let denied=command(&mut a,&uuid::Uuid::new_v4().to_string(),rev,folder_create(&ids[4],"attack",None)).await;
    assert_eq!(denied["error"]["code"],"FORBIDDEN");
    let stale=command(&mut dm,&uuid::Uuid::new_v4().to_string(),rev,journal_update(&page,2,"dm","overwrite")).await;
    assert_eq!(stale["error"]["code"],"STALE_JOURNAL");
    accepted(&mut dm,&mut rev,folder_update(&ids[0],1,"Renamed",None)).await;
    let stale=command(&mut dm,&uuid::Uuid::new_v4().to_string(),rev,folder_update(&ids[0],1,"overwrite",None)).await;
    assert_eq!(stale["error"]["code"],"STALE_JOURNAL_FOLDER");
    accepted(&mut dm,&mut rev,json!({"type":"journal.folder.delete","payload":{"folderId":ids[0],"expectedVersion":2}})).await;
    let (_,rest,_)=h.request("GET",&format!("/api/campaigns/{camp}/journals"),json!({}),Some(&owner)).await;
    assert_eq!(rest["folders"].as_array().unwrap().len(),4);
    let child=rest["folders"].as_array().unwrap().iter().find(|f|f["id"]==ids[1]).unwrap();
    assert!(child["parentId"].is_null()); assert_eq!(child["version"],2);
    let saved=rest["journals"].as_array().unwrap().iter().find(|p|p["id"]==page).unwrap();
    assert_eq!(saved["body"],"LITERAL_SHARED_BODY"); assert_eq!(saved["version"],4);
    assert!(saved.get("folderId").is_none());
    let body:String=sqlx::query_scalar("SELECT body FROM journals WHERE id=?").bind(&page).fetch_one(&h.state.store.pool).await.unwrap();
    assert_eq!(body,"LITERAL_SHARED_BODY");
}
#[tokio::test]
async fn journal_folders_reject_foreign_destinations_bad_fields_limits_and_archive() {
    let h=Host::new().await; let owner=h.owner().await; let camp=h.campaign_id(&owner).await;
    let server=LiveServer::start(&h).await; let mut dm=server.connect(&camp,&owner).await;frame(&mut dm).await;
    let foreign=uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO campaigns(id,name,created_by,created_at,updated_at) SELECT 'other-folder-camp','Other',created_by,1,1 FROM campaigns WHERE id=?").bind(&camp).execute(&h.state.store.pool).await.unwrap();
    sqlx::query("INSERT INTO journal_folders(id,campaign_id,name) VALUES(?,'other-folder-camp','FOREIGN FOLDER')").bind(&foreign).execute(&h.state.store.pool).await.unwrap();
    let id=uuid::Uuid::new_v4().to_string(); let mut rev=0;
    for cmd in [folder_create(&id,"",None),folder_create(&id,&"x".repeat(61),None),folder_create(&id,"bad\u{0}name",None),folder_create(&id,"Foreign",Some(&foreign))] {
      assert_eq!(command(&mut dm,&uuid::Uuid::new_v4().to_string(),rev,cmd).await["kind"],"error");
    }
    let missing=command(&mut dm,&uuid::Uuid::new_v4().to_string(),rev,json!({"type":"journal.folder.create","payload":{"folderId":id,"name":"Missing parent"}})).await;
    assert_eq!(missing["error"]["code"],"VALIDATION_FAILED");
    accepted(&mut dm,&mut rev,folder_create(&id,&"🐉".repeat(60),None)).await;
    // Seed the remaining quota directly; this test does not exercise the20-frame/s transport limiter.
    for _ in 1..16 {
        sqlx::query("INSERT INTO journal_folders(id,campaign_id,name) VALUES(?,?,'Folder')").bind(uuid::Uuid::new_v4().to_string()).bind(&camp).execute(&h.state.store.pool).await.unwrap();
    }
    let full=command(&mut dm,&uuid::Uuid::new_v4().to_string(),rev,folder_create(&uuid::Uuid::new_v4().to_string(),"Over quota",None)).await;
    assert_eq!(full["kind"],"error");
    let page=uuid::Uuid::new_v4().to_string();accepted(&mut dm,&mut rev,journal_create(&page,"Still private","Do not publish")).await;
    let denied=command(&mut dm,&uuid::Uuid::new_v4().to_string(),rev,page_move(&page,1,Some(&foreign))).await;
    assert_eq!(denied["error"]["code"],"NOT_FOUND_OR_HIDDEN");
    sqlx::query("UPDATE campaigns SET archived=1 WHERE id=?").bind(&camp).execute(&h.state.store.pool).await.unwrap();
    let archived=command(&mut dm,&uuid::Uuid::new_v4().to_string(),rev,folder_update(&id,1,"No archive edit",None)).await;
    assert_eq!(archived["error"]["code"],"FORBIDDEN");
}
