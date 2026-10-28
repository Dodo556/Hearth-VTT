// Local Lucide geometry (ISC), shared by HTML controls and Pixi markers.
import { ArrowDownToLine, Droplet, FlaskConical, Focus, Target, Zap } from "lucide-react";
export const tokenStatusCatalog = [
  {
    id: "marked",
    label: "Marked",
    Icon: Target,
    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f4eddc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-target" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>',
  },
  {
    id: "bleeding",
    label: "Bleeding",
    Icon: Droplet,
    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f4eddc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-droplet" aria-hidden="true"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"></path></svg>',
  },
  {
    id: "poisoned",
    label: "Poisoned",
    Icon: FlaskConical,
    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f4eddc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-flask-conical" aria-hidden="true"><path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2"></path><path d="M6.453 15h11.094"></path><path d="M8.5 2h7"></path></svg>',
  },
  {
    id: "prone",
    label: "Prone",
    Icon: ArrowDownToLine,
    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f4eddc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down-to-line" aria-hidden="true"><path d="M12 17V3"></path><path d="m6 11 6 6 6-6"></path><path d="M19 21H5"></path></svg>',
  },
  {
    id: "stunned",
    label: "Stunned",
    Icon: Zap,
    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f4eddc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-zap" aria-hidden="true"><path d="M15.914 4a1.5 1.5 0 0 0 -2.474 -1.561l-9 9A1.5 1.5 0 0 0 5.5 14h4.002a.5 .5 0 0 1 .471 .666L8.086 20a1.5 1.5 0 0 0 2.475 1.56l9-9A1.5 1.5 0 0 0 18.5 10h-3.997a.5 .5 0 0 1 -.472 -.667z"></path></svg>',
  },
  {
    id: "concentrating",
    label: "Concentrating",
    Icon: Focus,
    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f4eddc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-focus" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M7 21H5a2 2 0 0 1-2-2v-2"></path></svg>',
  },
] as const;
