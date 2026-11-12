import type { Lang } from '../game/types'

const en = `
cat on a skateboard|haunted house|astronaut|birthday cake|volcano|snowman melting|pirate ship|dragon|lighthouse|banana split
robot dog|traffic jam|mermaid|camping trip|hot air balloon|penguin waiter|alien abduction|time machine|treasure map|superhero
giraffe in a scarf|dentist|rainbow|tornado|yoga|selfie|spaghetti|surfing|ninja|vampire|wizard|zombie|unicorn|king|queen
igloo|cactus|fireworks|campfire|bubble bath|sleepwalking|tooth fairy|haircut|thunderstorm|parachute|roller coaster|karaoke
bowling|chess|marathon|swimming pool|beach volleyball|ice cream truck|garden gnome|scarecrow|lawn mower|washing machine
sneeze|hiccups|sunburn|bad hair day|first date|job interview|wedding|graduation|baby shower|road trip|lost luggage
octopus playing drums|shark attack|jellyfish|sloth|hedgehog|flamingo|kangaroo|panda eating bamboo|owl|bat|peacock
spider web|ant farm|bee hive|butterfly|snail race|frog prince|teddy bear|piggy bank|alarm clock|smartphone addiction
pizza delivery|sushi|taco tuesday|popcorn|cupcake|pancakes|hot dog|french fries|coffee break|lemonade stand
moon landing|black hole|shooting star|solar eclipse|satellite|ufo|mars rover|space station|comet
knight in armor|castle|throne|crown|magic wand|crystal ball|fortune teller|genie in a lamp|mummy|werewolf
skiing|ice skating|snowball fight|sledding|sandcastle|sunglasses|flip flops|umbrella|rain boots|kite
detective|firefighter|chef|doctor|pilot|farmer|mail carrier|lifeguard|magician|clown|mime|DJ|plumber
library|museum|zoo|circus|airport|hospital|supermarket|gym|bakery|barber shop
tug of war|hide and seek|musical chairs|piñata|fortune cookie|message in a bottle|haunted doll|fairy tale
dinosaur fossil|caveman|pyramid|statue of liberty|eiffel tower|great wall|volcano eruption|earthquake|tsunami
`

const de = `
Katze auf Skateboard|Spukhaus|Astronaut|Geburtstagstorte|Vulkan|schmelzender Schneemann|Piratenschiff|Drache|Leuchtturm|Bananensplit
Roboterhund|Stau|Meerjungfrau|Zeltlager|Heißluftballon|Pinguin als Kellner|Entführung durch Aliens|Zeitmaschine|Schatzkarte|Superheld
Giraffe mit Schal|Zahnarzt|Regenbogen|Tornado|Yoga|Selfie|Spaghetti|Surfen|Ninja|Vampir|Zauberer|Zombie|Einhorn|König|Königin
Iglu|Kaktus|Feuerwerk|Lagerfeuer|Schaumbad|Schlafwandeln|Zahnfee|Haarschnitt|Gewitter|Fallschirm|Achterbahn|Karaoke
Bowling|Schach|Marathon|Schwimmbad|Beachvolleyball|Eiswagen|Gartenzwerg|Vogelscheuche|Rasenmäher|Waschmaschine
Niesen|Schluckauf|Sonnenbrand|Bad-Hair-Day|erstes Date|Vorstellungsgespräch|Hochzeit|Abschlussfeier|Kindergeburtstag|Roadtrip|verlorener Koffer
Krake am Schlagzeug|Haiangriff|Qualle|Faultier|Igel|Flamingo|Känguru|Panda isst Bambus|Eule|Fledermaus|Pfau
Spinnennetz|Ameisenhaufen|Bienenstock|Schmetterling|Schneckenrennen|Froschkönig|Teddybär|Sparschwein|Wecker|Handysucht
Pizzalieferung|Sushi|Brezel|Popcorn|Cupcake|Pfannkuchen|Bratwurst|Pommes|Kaffeepause|Limonadenstand
Mondlandung|schwarzes Loch|Sternschnuppe|Sonnenfinsternis|Satellit|UFO|Marsrover|Raumstation|Komet
Ritter in Rüstung|Burg|Thron|Krone|Zauberstab|Kristallkugel|Wahrsagerin|Flaschengeist|Mumie|Werwolf
Skifahren|Schlittschuhlaufen|Schneeballschlacht|Schlittenfahren|Sandburg|Sonnenbrille|Flip-Flops|Regenschirm|Gummistiefel|Drachensteigen
Detektiv|Feuerwehrmann|Koch|Ärztin|Pilot|Bauer|Briefträger|Rettungsschwimmer|Zauberkünstler|Clown|Pantomime|DJ|Klempner
Bibliothek|Museum|Zoo|Zirkus|Flughafen|Krankenhaus|Supermarkt|Fitnessstudio|Bäckerei|Friseursalon
Tauziehen|Verstecken|Reise nach Jerusalem|Piñata|Glückskeks|Flaschenpost|Gartenparty|Märchen
Dinosaurierknochen|Höhlenmensch|Pyramide|Freiheitsstatue|Eiffelturm|Chinesische Mauer|Erdbeben|Tsunami|Oktoberfest|Weihnachtsmarkt
Kuckucksuhr|Sauna|Fahrradtour|Biergarten|Schultüte|Adventskranz|Osterhase|Nikolaus|Kehrwoche|Autobahn
`

const sv = `
katt på skateboard|spökhus|astronaut|födelsedagstårta|vulkan|smältande snögubbe|piratskepp|drake|fyr|bananasplit
robothund|bilkö|sjöjungfru|campingresa|luftballong|pingvin som servitör|utomjordisk kidnappning|tidsmaskin|skattkarta|superhjälte
giraff med halsduk|tandläkare|regnbåge|tornado|yoga|selfie|spagetti|surfing|ninja|vampyr|trollkarl|zombie|enhörning|kung|drottning
igloo|kaktus|fyrverkeri|lägereld|bubbelbad|sömngång|tandfén|klippning|åskväder|fallskärm|berg-och-dalbana|karaoke
bowling|schack|maraton|simbassäng|beachvolley|glassbil|trädgårdstomte|fågelskrämma|gräsklippare|tvättmaskin
nysning|hicka|solbränna|dålig hårdag|första dejten|anställningsintervju|bröllop|studentexamen|barnkalas|bilsemester|borttappat bagage
bläckfisk som spelar trummor|hajattack|manet|sengångare|igelkott|flamingo|känguru|panda som äter bambu|uggla|fladdermus|påfågel
spindelnät|myrstack|bikupa|fjäril|snigellopp|grodprins|nallebjörn|spargris|väckarklocka|mobilberoende
pizzabud|sushi|tacofredag|popcorn|muffins|pannkakor|korv med bröd|pommes frites|fika|saftförsäljning
månlandning|svart hål|stjärnfall|solförmörkelse|satellit|ufo|marsbil|rymdstation|komet
riddare i rustning|slott|tron|krona|trollstav|kristallkula|spåkvinna|ande i lampa|mumie|varulv
skidåkning|skridskoåkning|snöbollskrig|pulka|sandslott|solglasögon|flipflops|paraply|gummistövlar|drake som flyger
detektiv|brandman|kock|läkare|pilot|bonde|brevbärare|livräddare|trollkonstnär|clown|mim|DJ|rörmokare
bibliotek|museum|djurpark|cirkus|flygplats|sjukhus|mataffär|gym|bageri|frisör
dragkamp|kurragömma|hela havet stormar|piñata|lyckokaka|flaskpost|sagobok|midsommarstång
dinosauriefossil|grottmänniska|pyramid|frihetsgudinnan|eiffeltornet|kinesiska muren|jordbävning|tsunami
kräftskiva|lucia|dalahäst|surströmming|kanelbulle|älg|vikingaskepp|bastu|kanottur|allemansrätten
`

const parse = (s: string) =>
  Array.from(new Set(s.split(/[|\n]/).map((w) => w.trim()).filter(Boolean)))

export const WORDS: Record<Lang, string[]> = { en: parse(en), de: parse(de), sv: parse(sv) }

export function dealWords(lang: Lang, count: number, exclude: string[]): string[] {
  const pool = WORDS[lang].filter((w) => !exclude.includes(w))
  const source = pool.length >= count ? pool : WORDS[lang]
  const copy = [...source]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, count)
}
