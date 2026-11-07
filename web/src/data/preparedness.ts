/**
 * Preparedness content (based on NDMA public guidelines, simplified for citizens).
 * Used by /prepare: Learn modules, practice drills, emergency kit and helplines.
 */
export interface Module { id: string; emoji: string; title: string; before: string[]; during: string[]; after: string[] }
export interface Question { id: string; hazard: string; scenario: string; options: string[]; answer: number; why: string }

export const MODULES: Module[] = [
  {
    id: 'flood', emoji: '🌊', title: 'Floods',
    before: ['Know your area\'s flood risk on ResQGrid and the route to the nearest relief camp', 'Keep documents and medicines in waterproof bags on a high shelf', 'Move vehicles, valuables and electrical items to higher floors', 'Stock drinking water, dry food and a torch for 3 days'],
    during: ['Move to higher floors or higher ground immediately', 'Never walk or drive through moving water — 15 cm can knock you down, 60 cm can sweep away a car', 'Switch off electricity and gas at the main', 'Stay away from drains, open manholes and electric poles'],
    after: ['Return home only when authorities say it is safe', 'Boil or purify drinking water', 'Watch for snakes and damaged wiring', 'Photograph damage for relief and insurance claims'],
  },
  {
    id: 'cyclone', emoji: '🌀', title: 'Cyclones',
    before: ['Follow IMD cyclone warnings and evacuation orders', 'Board up windows; tie down loose roofing sheets', 'Fishermen must not go to sea after a warning', 'Know the nearest cyclone shelter'],
    during: ['Stay indoors in the strongest room, away from windows', 'If the eye passes and wind drops, stay inside — strong winds return from the other side', 'Keep the radio / phone on for official updates', 'Evacuate early if you live on the coast or in a kutcha house'],
    after: ['Avoid fallen power lines and damaged buildings', 'Do not spread rumours; share only official information', 'Help neighbours, especially the elderly', 'Report damage on ResQGrid with a photo'],
  },
  {
    id: 'heatwave', emoji: '🔥', title: 'Heatwaves',
    before: ['Check the forecast and plan outdoor work for early morning', 'Keep ORS, water and light cotton clothes ready', 'Know the signs of heat stroke'],
    during: ['Stay indoors between 12 pm and 4 pm', 'Drink water often, even if not thirsty; avoid alcohol and very sugary drinks', 'Never leave children or pets in parked vehicles', 'Check on elderly neighbours twice a day'],
    after: ['Heat stroke (hot dry skin, confusion) is an emergency — call 108 and cool the person with water', 'Keep drinking fluids for the next few days', 'Rest; avoid heavy work until temperatures fall'],
  },
  {
    id: 'landslide', emoji: '⛰️', title: 'Landslides',
    before: ['Avoid building or staying at the base of steep slopes', 'Watch for new cracks in walls, tilting trees or poles', 'Know an evacuation route that avoids the slope'],
    during: ['Move away from the path of the slide immediately — sideways, not downhill', 'Listen for rumbling or cracking sounds', 'Do not cross bridges or ghat roads during heavy rain'],
    after: ['Stay away from the slide area — more slides can follow', 'Check for injured or trapped people and call 112', 'Report blocked roads and broken lines'],
  },
  {
    id: 'earthquake', emoji: '🏚️', title: 'Earthquakes',
    before: ['Fix heavy furniture and cylinders to walls', 'Identify safe spots: under strong tables, against inner walls', 'Practise Drop–Cover–Hold On with your family'],
    during: ['Drop, Cover under a sturdy table, and Hold On', 'Stay away from glass, windows and heavy objects', 'If outside, move to an open area away from buildings and wires', 'Do not use lifts'],
    after: ['Expect aftershocks; leave damaged buildings', 'Check for gas leaks — do not light matches', 'Use stairs, not lifts', 'Text instead of calling to keep lines free'],
  },
];

export const QUESTIONS: Question[] = [
  { id: 'q1', hazard: '🌊 Flood', scenario: 'The road to your house has 40 cm of fast-flowing water. Your car is a big SUV.', options: ['Drive through slowly in first gear', 'Turn back and take another route or wait', 'Walk through holding the car door'], answer: 1, why: 'Just 60 cm of moving water can float a car and 15 cm can knock a person down. Turn around, don\'t drown.' },
  { id: 'q2', hazard: '🌊 Flood', scenario: 'Water is entering your ground floor. What should you do FIRST?', options: ['Save the TV and fridge', 'Switch off electricity at the main and move upstairs', 'Open the doors to let water out'], answer: 1, why: 'Electricity + water is the biggest killer indoors. Switch off the main, then move to higher floors.' },
  { id: 'q3', hazard: '🌀 Cyclone', scenario: 'During a cyclone the wind suddenly stops and the sky looks calm.', options: ['The cyclone is over — go out and check damage', 'Stay inside — this is the eye, winds will return', 'Open windows to equalise pressure'], answer: 1, why: 'The calm is the eye of the storm. Violent winds return from the opposite direction within minutes.' },
  { id: 'q4', hazard: '🔥 Heatwave', scenario: 'An elderly neighbour is confused, skin hot and dry, not sweating, on a 45°C afternoon.', options: ['Give them a hot cup of tea and let them rest', 'Call 108, move them to shade and cool them with water', 'Wait for the evening to see if it improves'], answer: 1, why: 'These are signs of heat stroke — a medical emergency. Cool the body fast and get help.' },
  { id: 'q5', hazard: '🔥 Heatwave', scenario: 'Best time to do outdoor work during a heatwave?', options: ['12 pm to 3 pm', 'Early morning or after sunset', 'Any time if you wear a cap'], answer: 1, why: 'Avoid the peak heat hours of 12–4 pm.' },
  { id: 'q6', hazard: '⛰️ Landslide', scenario: 'You hear a loud rumbling from the hill above your house during heavy rain.', options: ['Go and look at the slope', 'Move quickly away from the slide path, sideways', 'Hide in the basement'], answer: 1, why: 'Rumbling can mean an imminent landslide. Move out of its path — sideways, not downhill.' },
  { id: 'q7', hazard: '🏚️ Earthquake', scenario: 'The building starts shaking strongly while you are in a classroom.', options: ['Run down the stairs immediately', 'Drop, take cover under a desk and hold on', 'Stand near the window to see outside'], answer: 1, why: 'Most injuries come from falling objects and running. Drop–Cover–Hold On until shaking stops.' },
  { id: 'q8', hazard: '📢 Alerts', scenario: 'A WhatsApp forward says "Dam will burst in 1 hour, run!" but there is no official alert.', options: ['Forward it to all groups quickly', 'Check ResQGrid / official sources before acting or sharing', 'Ignore all alerts from now on'], answer: 1, why: 'Rumours cause panic. Verify with official sources (IMD, NDMA, local authority, ResQGrid alerts).' },
];

export const KIT: string[] = [
  'Drinking water (3 litres per person per day, for 3 days)', 'Dry food: biscuits, chana, dry fruits', 'Torch with spare batteries', 'Power bank, fully charged',
  'First-aid kit and personal medicines', 'Copies of Aadhaar, bank & insurance papers in a waterproof pouch', 'Cash in small notes', 'Whistle to signal for help',
  'ORS packets', 'Candles and matchbox in a waterproof box', 'Spare clothes and a blanket', 'Battery / phone FM radio',
];

export const HELPLINES: [string, string][] = [
  ['112', 'National emergency (police, fire, ambulance)'], ['1078', 'NDMA disaster helpline'], ['1070', 'State disaster control room'],
  ['108', 'Ambulance'], ['101', 'Fire'], ['100', 'Police'], ['1091', 'Women helpline'], ['1098', 'Child helpline'],
];
