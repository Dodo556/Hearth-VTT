use hearth_domain::dice::{DiceError, evaluate, parse};
#[test]
fn precedence_grouping_and_negative_modifiers_are_auditable() {
    let ast = parse(" 2d6 + 3 * 2 ").unwrap();
    let mut faces = [1, 2].into_iter();
    let result = evaluate(&ast, &mut |_| Ok(faces.next().unwrap())).unwrap();
    assert_eq!(result.total, 9.0);
    assert_eq!(result.dice[0].faces, vec![1, 2]);
    assert_eq!(result.dice[0].subtotal, 3);
    let ast = parse("-(D4+2)/2").unwrap();
    assert_eq!(evaluate(&ast, &mut |s| Ok(s)).unwrap().total, -3.0);
    assert_eq!(parse(&ast.normalized()).unwrap(), ast);
}
#[test]
fn parser_and_evaluator_bound_all_work_and_arithmetic() {
    for invalid in [
        "",
        "0d6",
        "101d6",
        "d0",
        "d1000001",
        "1000001",
        "100d6+d6",
        "2**3",
        "1e2",
        "1.5",
        "alert(1)",
        "d6<script>",
        "😀",
        "1\n+2",
    ] {
        assert!(parse(invalid).is_err(), "{invalid}");
    }
    assert!(parse(&"(".repeat(13)).is_err());
    assert!(parse(&format!("{}d6{}", "(".repeat(13), ")".repeat(13))).is_err());
    assert!(parse(&"1+".repeat(61)).is_err());
    assert!(evaluate(&parse("1/0").unwrap(), &mut |s| Ok(s)).is_err());
    assert!(evaluate(&parse("1000000*1000000").unwrap(), &mut |s| Ok(s)).is_err());
    assert_eq!(
        evaluate(&parse("d6").unwrap(), &mut |_| Err(DiceError::Entropy)),
        Err(DiceError::Entropy)
    );
    assert!(evaluate(&parse("d6").unwrap(), &mut |_| Ok(7)).is_err());
    assert_eq!(
        evaluate(&parse("100d1").unwrap(), &mut |_| Ok(1))
            .unwrap()
            .total,
        100.0
    );
}
#[test]
fn generated_expressions_round_trip_and_faces_stay_bounded() {
    for n in 0..1024 {
        let count = n % 10 + 1;
        let sides = n % 97 + 1;
        let modifier = n % 20;
        let text = format!("({count}D{sides}+{modifier})*2");
        let ast = parse(&text).unwrap();
        let normalized = ast.normalized();
        assert_eq!(parse(&normalized).unwrap(), ast);
        let value = evaluate(&ast, &mut |s| Ok(s)).unwrap();
        assert_eq!(value.total, ((count * sides + modifier) * 2) as f64);
        assert_eq!(
            value.dice.iter().flat_map(|d| &d.faces).count(),
            count as usize
        );
    }
    // Deterministic test-only generator; production uses operating-system entropy.
    let mut state = 918273645u64;
    let alphabet = b"0123456789dD+-*/() x\t\n";
    for _ in 0..10000 {
        state ^= state << 13;
        state ^= state >> 7;
        state ^= state << 17;
        let len = (state % 140) as usize;
        let mut text = String::new();
        for _ in 0..len {
            state ^= state << 13;
            state ^= state >> 7;
            state ^= state << 17;
            text.push(alphabet[state as usize % alphabet.len()] as char);
        }
        if let Ok(ast) = parse(&text) {
            assert_eq!(parse(&ast.normalized()).unwrap(), ast);
            if let Ok(value) = evaluate(&ast, &mut |s| Ok(s)) {
                assert!(value.total.is_finite() && value.total.abs() <= 1_000_000_000.0);
                assert!(value.dice.iter().map(|d| d.faces.len()).sum::<usize>() <= 100);
                assert!(
                    value
                        .dice
                        .iter()
                        .all(|d| d.faces.iter().all(|f| *f >= 1 && *f <= d.sides))
                );
            }
        }
    }
}
