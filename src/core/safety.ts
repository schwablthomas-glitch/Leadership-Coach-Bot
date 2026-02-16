// @ts-nocheck
const SAFETY_TEXT =
  'Ich kann dabei nicht helfen, bitte wende dich an professionelle Hilfe oder interne Anlaufstellen (z. B. HR, EAP, Notfallkontakt).';

const crisisPattern = /(suizid|selbstmord|ich will nicht mehr leben|kill myself|self-harm|umbringen)/i;
const violencePattern = /(gewalt|verletzen|jemandem schaden|waffe|angreifen|töten)/i;
const medicalPattern = /(medizin|diagnose|medikament|akute schmerzen|notfall|depression)/i;

export function safetyRouter(input: string): { route: 'escalation' | 'coaching'; text?: string } {
  if (crisisPattern.test(input) || violencePattern.test(input) || medicalPattern.test(input)) {
    return { route: 'escalation', text: SAFETY_TEXT };
  }
  return { route: 'coaching' };
}
