import { routing } from "@/i18n/routing";
import { STORAGE_KEYS } from "./storage";

// Small scripts that run in <head> before the page paints.

// Applies dark mode and lite mode before first paint, so there's no flash.
export const themeScript = `(function(){try{var s=localStorage,r=document.documentElement,t=s.getItem(${JSON.stringify(
  STORAGE_KEYS.theme,
)});if(t==="dark"||((!t||t==="system")&&matchMedia("(prefers-color-scheme: dark)").matches))r.setAttribute("data-theme","dark");if(s.getItem(${JSON.stringify(
  STORAGE_KEYS.lite,
)})==="1")r.setAttribute("data-lite","")}catch(e){}})()`;

// "/" sends visitors to their saved language, else the phone's language, else the default.
export const localeRedirectScript = `(function(){var l=${JSON.stringify(
  routing.defaultLocale,
)},ok=${JSON.stringify(routing.locales)};try{var s=localStorage.getItem(${JSON.stringify(
  STORAGE_KEYS.locale,
)});if(ok.indexOf(s)>-1)l=s;else if((navigator.language||"").toLowerCase().indexOf("bn")===0)l="bn"}catch(e){}location.replace("/"+l+"/"+location.search+location.hash)})()`;
