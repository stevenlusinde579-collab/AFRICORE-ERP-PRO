const TOPIC_RULES = [
    ["English Language", "Reading comprehension", "Reading for meaning", [/\b(read|reading|passage|comprehension|answer the questions that follow)\b/i]],
    ["English Language", "Grammar", "Verb forms and tenses", [/\b(verb|verbs|tense|present simple|past tense|correct form|daily routine|conjugat|subject[- ]verb agreement)\b/i]],
    ["English Language", "Grammar", "Parts of speech", [/\b(noun|pronoun|adjective|adverb|preposition|conjunction)\b/i]],
    ["English Language", "Vocabulary", "Spelling and word formation", [/\b(jumbled letters|spell|spelling|rearrange the letters|word formation|meaning of the word)\b/i]],
    ["English Language", "Writing", "Guided and creative composition", [/\b(composition|write a letter|story|paragraph|essay|describe your)\b/i]],
    ["English Language", "Language conventions", "Punctuation and capitalization", [/\b(punctuation|capital letter|comma|full stop|question mark)\b/i]],

    ["Mathematics", "Number", "Operations and place value", [/\b(add|addition|subtract|subtraction|multiply|multiplication|divide|division|place value|round off|whole numbers?)\b/i]],
    ["Mathematics", "Fractions", "Fraction operations and equivalence", [/\b(fraction|numerator|denominator|equivalent fractions?)\b/i]],
    ["Mathematics", "Percentages", "Percentage calculations", [/\b(percent(?:age)?|per cent|discount|profit percent)\b/i]],
    ["Mathematics", "Ratio and proportion", "Ratios, rates and proportion", [/\b(ratio|proportion|rate|direct variation|inverse variation)\b/i]],
    ["Mathematics", "Algebra", "Expressions and equations", [/\b(algebra|equation|inequalit|factoris|factoriz|linear expression|unknown value)\b/i]],
    ["Mathematics", "Geometry", "Shapes, angles and properties", [/\b(angle|triangle|rectangle|square|circle|polygon|perimeter|area|volume|parallel lines)\b/i]],
    ["Mathematics", "Measurement", "Units and conversions", [/\b(measure|length|mass|capacity|time|temperature|convert.*units?)\b/i]],
    ["Mathematics", "Statistics", "Data handling and averages", [/\b(mean|median|mode|frequency|bar chart|pie chart|data|statistics|graph)\b/i]],
    ["Mathematics", "Probability", "Chance and probability", [/\b(probability|likely|unlikely|chance|random event)\b/i]],

    ["Biology", "Cell biology", "Cell structure and organisation", [/\b(cell membrane|nucleus|cytoplasm|cell organelle|cell structure|mitosis|meiosis)\b/i]],
    ["Biology", "Nutrition", "Nutrition in plants and animals", [/\b(nutrition|photosynthesis|digestion|balanced diet|food test|enzymes?)\b/i]],
    ["Biology", "Transport", "Transport in living organisms", [/\b(transport in plants|transpiration|translocation|blood circulation|blood vessel|heart)\b/i]],
    ["Biology", "Reproduction", "Reproductive processes", [/\b(reproduction|fertili[sz]ation|pollination|menstrual cycle|reproductive system)\b/i]],
    ["Biology", "Ecology", "Ecosystems and interactions", [/\b(ecosystem|food chain|food web|habitat|population ecology|biodiversity|environment)\b/i]],
    ["Biology", "Genetics", "Inheritance and variation", [/\b(genetics|inheritance|gene|chromosome|allele|heredity|variation)\b/i]],

    ["Chemistry", "Atomic structure", "Atoms, isotopes and subatomic particles", [/\b(atom|proton|neutron|electron|isotope|atomic number|mass number)\b/i]],
    ["Chemistry", "Chemical bonding", "Ionic and covalent bonding", [/\b(ionic bond|covalent bond|metallic bond|chemical bond|bonding)\b/i]],
    ["Chemistry", "Acids, bases and salts", "Acidity, alkalinity and neutralisation", [/\b(acid|alkali|base|neutralisation|neutralization|ph scale|salt preparation)\b/i]],
    ["Chemistry", "Chemical reactions", "Reaction types and equations", [/\b(chemical reaction|reactant|product|balanced equation|oxidation|reduction|redox)\b/i]],
    ["Chemistry", "Periodic table", "Periodic trends and groups", [/\b(periodic table|group [0-8]|periodic trend|atomic radius|electronegativity)\b/i]],
    ["Chemistry", "Separation of mixtures", "Filtration, distillation and chromatography", [/\b(mixture|filtration|distillation|chromatography|decantation|separation technique)\b/i]],
    ["Chemistry", "Organic chemistry", "Hydrocarbons and functional groups", [/\b(hydrocarbon|alkane|alkene|alkyne|organic compound|functional group)\b/i]],

    ["Physics", "Mechanics", "Motion, speed and acceleration", [/\b(motion|speed|velocity|acceleration|displacement|distance[- ]time graph)\b/i]],
    ["Physics", "Mechanics", "Forces and Newton's laws", [/\b(force|newton'?s law|friction|momentum|impulse|equilibrium)\b/i]],
    ["Physics", "Energy", "Work, energy and power", [/\b(work done|kinetic energy|potential energy|power|conservation of energy)\b/i]],
    ["Physics", "Electricity", "Current, voltage and circuits", [/\b(electric current|voltage|potential difference|resistance|circuit|ohm'?s law)\b/i]],
    ["Physics", "Waves", "Wave properties and sound", [/\b(wave|frequency|wavelength|amplitude|sound|reflection|refraction)\b/i]],
    ["Physics", "Heat", "Thermal energy and transfer", [/\b(heat|temperature|thermal|conduction|convection|radiation|specific heat)\b/i]],
    ["Physics", "Pressure", "Pressure in fluids and solids", [/\b(pressure|pascal|hydraulic|atmospheric pressure|density)\b/i]],

    ["Geography", "Map work", "Scale, direction and map interpretation", [/\b(map reading|map scale|bearing|contour|grid reference|map interpretation)\b/i]],
    ["Geography", "Weather and climate", "Weather elements and climate", [/\b(weather|climate|rainfall|temperature|humidity|wind|气候)\b/i]],
    ["Geography", "Population", "Population distribution and change", [/\b(population|migration|birth rate|death rate|population density)\b/i]],
    ["Geography", "Physical geography", "Landforms and geomorphic processes", [/\b(erosion|weathering|river|mountain|volcano|earthquake|landform)\b/i]],
    ["Geography", "Environment", "Environmental management", [/\b(environment|pollution|conservation|deforestation|desertification)\b/i]],

    ["History", "Colonialism", "Colonial rule and its effects", [/\b(colonialism|colonial rule|colonial administration|colonial economy)\b/i]],
    ["History", "Nationalism", "Rise of nationalist movements", [/\b(nationalism|nationalist movement|independence struggle|liberation movement)\b/i]],
    ["History", "Slave trade", "Slave trade and abolition", [/\b(slave trade|abolition of slavery|slavery)\b/i]],
    ["History", "Pre-colonial societies", "Social, political and economic organisation", [/\b(pre[- ]colonial|precolonial|traditional societies|iron working)\b/i]],

    ["Civics", "Constitution", "Constitutional principles and governance", [/\b(constitution|constitutional|separation of powers|rule of law)\b/i]],
    ["Civics", "Human rights", "Rights, duties and responsibilities", [/\b(human rights|civil rights|freedom|rights and duties)\b/i]],
    ["Civics", "Democracy", "Elections and democratic participation", [/\b(democracy|election|voting|political participation|multiparty)\b/i]],
    ["Civics", "Citizenship", "Citizenship and national identity", [/\b(citizen|citizenship|national identity|patriotism)\b/i]],

    ["Accounting", "Books of original entry", "Journals and subsidiary books", [/\b(journal|books? of original entry|sales day book|purchases day book|returns inward|returns outward)\b/i]],
    ["Accounting", "Ledger accounts", "Posting, balancing and classification", [/\b(ledger|posting|debit|credit|balance off)\b/i]],
    ["Accounting", "Trial balance", "Preparation and correction of errors", [/\b(trial balance|errors not disclosed|suspense account)\b/i]],
    ["Accounting", "Cash book", "Cash and bank transactions", [/\b(cash book|petty cash|bank reconciliation|cash discount)\b/i]],
    ["Accounting", "Financial statements", "Income statement and statement of financial position", [/\b(income statement|profit and loss account|balance sheet|financial statement|statement of financial position)\b/i]],
    ["Accounting", "Depreciation", "Depreciation methods and asset values", [/\b(depreciation|reducing balance|straight line method|asset disposal)\b/i]],

    ["Commerce", "Trade", "Home and international trade", [/\b(trade|wholesale|retail|import|export|entrepot)\b/i]],
    ["Commerce", "Banking", "Banking services and instruments", [/\b(bank|banking|cheque|savings account|current account|mobile money)\b/i]],
    ["Commerce", "Insurance", "Principles and types of insurance", [/\b(insurance|premium|indemnity|insurable interest|policy)\b/i]],
    ["Commerce", "Transport", "Transport systems and services", [/\b(transport|road transport|railway|air transport|shipping)\b/i]],
    ["Commerce", "Entrepreneurship", "Business formation and enterprise", [/\b(entrepreneur|entrepreneurship|business plan|enterprise|start[- ]up)\b/i]],

    ["Agriculture", "Soil science", "Soil properties and management", [/\b(soil|soil profile|soil fertility|soil texture|soil erosion)\b/i]],
    ["Agriculture", "Crop production", "Crop husbandry and field practices", [/\b(crop|planting|weeding|harvesting|seedbed|cultivation)\b/i]],
    ["Agriculture", "Livestock production", "Animal husbandry and management", [/\b(livestock|cattle|goat|sheep|poultry|animal husbandry)\b/i]],
    ["Agriculture", "Pests and diseases", "Identification and control", [/\b(pest|crop disease|fungus|fungal|insect pest|disease control)\b/i]],
    ["Agriculture", "Irrigation", "Water management in agriculture", [/\b(irrigation|drainage|water harvesting)\b/i]],

    ["Kiswahili", "Sarufi", "Aina za maneno na miundo ya lugha", [/\b(sarufi|nomino|kitenzi|kivumishi|kiwakilishi|nyakati|ngeli)\b/i]],
    ["Kiswahili", "Fasihi", "Fasihi simulizi na andishi", [/\b(fasihi|methali|nahau|tamthilia|riwaya|ushairi|hadithi)\b/i]],
    ["Kiswahili", "Ufahamu", "Ufahamu wa habari na matini", [/\b(ufahamu|soma kifungu|jibu maswali kutokana na habari)\b/i]],
    ["Kiswahili", "Insha", "Uandishi wa insha na barua", [/\b(insha|barua rasmi|barua ya kirafiki|utungaji)\b/i]],
    ["Science and Technology", "Scientific investigation", "Observation, experiments and scientific methods", [/\b(science|scientist|scientific investigation|experiment|observation|investigation|majaribio|uchunguzi)\b/i]],
    ["Science and Technology", "Living things", "Living and non-living things", [/\b(living things?|non[- ]living|organism|plants?|animals?|viumbe hai|kiumbe hai|mimea|wanyama)\b/i]],
    ["Science and Technology", "Human body and health", "Sense organs, body systems and health", [/\b(sense organs?|eye|ear|nose|tongue|skin|hearing|sight|smell|taste|touch|health|hygiene|organs?|milango ya fahamu|jicho|sikio|pua|ulimi|ngozi|usafi|upumuaji)\b/i]],
    ["Science and Technology", "Matter", "Materials and states of matter", [/\b(states? of matter|solid|liquid|gas|materials?|matter|hali za mada|hewa|gesi|kimiminika|imara)\b/i]],
    ["Science and Technology", "Energy", "Sources and forms of energy", [/\b(energy|sun|light|heat|sound|electricity|source of energy|nishati|jua|mwanga|joto|sauti|umeme)\b/i]],
    ["Science and Technology", "Force and motion", "Forces, movement and simple machines", [/\b(force|motion|movement|friction|gravity|machines?|nguvu|mwendo)\b/i]],
    ["Science and Technology", "Environment", "Environment, conservation and ecosystems", [/\b(environment|pollution|conservation|habitat|food chain|mazingira|uhifadhi)\b/i]],
    ["Science and Technology", "Earth and space", "The Earth, weather and space", [/\b(earth|planet|solar system|weather|rain|cloud|sunrise|sunset|dunia|hali ya hewa|mvua)\b/i]],
];

const normalise = value => String(value || "").toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();

const subjectMatches = (ruleSubject, subject) => {
    const s = normalise(subject);
    if (!s) return false;
    const aliases = {
        "English Language": ["english", "english language"],
        "Mathematics": ["mathematics", "maths", "mathematics"],
        "Biology": ["biology", "biological science"],
        "Chemistry": ["chemistry"],
        "Physics": ["physics"],
        "Geography": ["geography"],
        "History": ["history"],
        "Civics": ["civics", "civic education"],
        "Accounting": ["accounting", "book keeping", "bookkeeping"],
        "Commerce": ["commerce"],
        "Agriculture": ["agriculture", "agricultural science"],
        "Kiswahili": ["kiswahili", "swahili"],
        "Science and Technology": ["science and technology", "science", "general science"],
    };
    return (aliases[ruleSubject] || [ruleSubject.toLowerCase()]).some(alias => s.includes(alias));
};

const classifyLevel = value => {
    const level = normalise(value);
    if (/baby class|nursery|kindergarten|pre[- ]?primary|early years/.test(level)) return "early_years";
    if (/standard|std\.?|primary|grade [1-7]/.test(level)) return "primary";
    if (/form [1-4]|form (one|two|three|four)|o[- ]?level|ordinary level/.test(level)) return "ordinary_secondary";
    if (/form [5-6]|form (five|six)|a[- ]?level|advanced level/.test(level)) return "advanced_secondary";
    if (/college|university|certificate|diploma|degree/.test(level)) return "tertiary";
    return "general";
};

export const inferCurriculumTopic = ({ questionText, subjectName, level = "" }) => {
    const text = normalise(questionText);
    const levelGroup = classifyLevel(level);
    const candidates = TOPIC_RULES
        .filter(([subject]) => subjectMatches(subject, subjectName))
        .map(([subject, topic, subTopic, patterns]) => {
            const evidence = patterns
                .map(pattern => [...text.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g"))])
                .flat()
                .map(match => match[0]);
            const uniqueEvidence = [...new Set(evidence.map(normalise))];
            // Specific multi-word concepts carry more weight than isolated generic words.
            const score = uniqueEvidence.reduce((total, phrase) => {
                const words = phrase.split(" ").length;
                const generic = /^(read|reading|data|time|work|power|trade|bank|soil|crop|cell|force|area|mean)$/i.test(phrase);
                return total + (generic ? 1 : Math.min(10, words * 3 + 1));
            }, 0);
            return { subject, topic, sub_topic: subTopic, evidence: uniqueEvidence, score, raw_score: score };
        })
        .filter(item => item.raw_score > 0)
        .sort((a, b) => b.score - a.score);

    if (!candidates.length) {
        return { topic: null, sub_topic: null, topic_confidence: 0, topic_evidence: null, topic_source: "not_identified", topic_alternatives: [], curriculum_level: levelGroup };
    }

    const best = candidates[0];
    const second = candidates.find(item => item.topic !== best.topic || item.sub_topic !== best.sub_topic);
    const margin = best.score - (second?.score || 0);
    const confidence = Math.max(20, Math.min(95, Math.round(35 + Math.min(6, best.raw_score) * 7 + Math.max(0, margin) * 6)));
    const ambiguous = Boolean(second && margin <= 2);
    return {
        topic: ambiguous ? null : best.topic,
        sub_topic: ambiguous ? null : best.sub_topic,
        topic_confidence: confidence,
        topic_evidence: best.evidence.slice(0, 4).join("; "),
        topic_source: ambiguous ? "ambiguous_rule_match" : "question_text_rule_match",
        topic_alternatives: candidates.slice(0, 3).map(item => ({ topic: item.topic, sub_topic: item.sub_topic, evidence: item.evidence.slice(0, 2) })),
        curriculum_level: levelGroup,
    };
};

export default inferCurriculumTopic;
