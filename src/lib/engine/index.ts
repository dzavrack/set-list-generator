// Set-list engine: pure, framework-free port of the old single-file app's builder.
export { DEFAULT_RULES, defaultRules, mergeRules, RULE_GROUPS, JAZZ_ONLY_RULES } from "./rules";
export type { RuleDef, RuleGroup, RuleUnit } from "./rules";
export { feelOf, feelLabel, feelFromLabel, minutesFor, minutesForFeel, baseMinutes, settingFactor, UP_TUNES } from "./feel";
export type { Feel } from "./feel";
export { parseGigRequest, describeRequest, autoName, parseDate } from "./parse";
export type { EngineGigRequest, ParseOptions } from "./parse";
export { planShape } from "./shape";
export type { GigShape } from "./shape";
export { buildSetList, retime, setMinutes, listMinutes, itemFeel, suggestReplacement } from "./build";
export type { BuildInput } from "./build";
export { checkSet, checkSetList } from "./check";
export type { Warning, WarningRule, CheckContext } from "./check";
export { makeRng } from "./rng";
export { TEMPO_CODES, TEMPO_LABELS, splitStyles, stylesOf, decadeOf, decadeLabel, normKey, normTitle } from "./util";
