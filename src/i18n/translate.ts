import english from './en.json';
import arabic from './ar.json';
export type MessageValues = Record<string, string | number | undefined>;
export type Translator = (key: string, values?: MessageValues | string) => string;
export function createTranslator(language: string): Translator {
  return (key, values) => {
    if (key === 'en' && values === 'ar') return language === 'ar' ? 'ar' : 'en';
    const messages = (language === 'ar' ? arabic : english) as Record<string, string>;
    const template =
      (Object.hasOwn(messages, key) ? messages[key] : undefined) ??
      (Object.hasOwn(english, key) ? (english as Record<string, string>)[key] : undefined) ??
      (typeof values === 'string' && language === 'ar' ? values : key);
    return typeof values === 'object'
      ? template.replace(/\{(\w+)\}/g, (match, name) =>
          values[name] === undefined ? '' : String(values[name]),
        )
      : template;
  };
}

export function messagePair(key: string) {
  return { en: createTranslator('en')(key), ar: createTranslator('ar')(key) };
}
