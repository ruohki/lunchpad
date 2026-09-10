/**
 * Translations. English is the only bundled language for now; every string in
 * the UI goes through `t()` so more languages are a JSON file away.
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";

export const resources = { en: { translation: en } } as const;
export const SUPPORTED_LANGUAGES = Object.keys(resources);

function detectLanguage(): string {
  try {
    const wanted = navigator.language.toLowerCase().split("-")[0];
    return SUPPORTED_LANGUAGES.includes(wanted) ? wanted : "en";
  } catch {
    return "en";
  }
}

void i18n.use(initReactI18next).init({
  resources,
  lng: detectLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
