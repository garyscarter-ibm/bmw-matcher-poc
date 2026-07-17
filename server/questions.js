/*
 * Quiz definition. Each question:
 *  id:       key used in the answers object
 *  title:    question shown to the user
 *  help:     optional sub-text
 *  multi:    true → multi-select (answer is an array of values)
 *  type:     'slider' → a range input (answer is a number); otherwise an option
 *            list. Slider questions carry min/max/step/format/plusAtMax and no
 *            `options`.
 *  showIf:   optional (answers) => boolean, for conditional questions
 *  options:  { value, label, sub? }
 *
 * The `answers` object produced by the quiz is the engine's only input,
 * so adding a question here means teaching engine.js about its id.
 */

export const QUESTIONS = [
  {
    id: 'budget',
    title: 'What’s your budget?',
    help: 'Rough on the road price. We’ll flag anything that’s a slight stretch.',
    // A continuous £ value. The engine still understands the legacy b1–b5 band
    // keys (see budgetRange in engine.js) so old shared links keep working, but
    // the quiz now sends a number.
    type: 'slider',
    min: 0,
    max: 150000,
    step: 1000,
    format: 'gbp',
    plusAtMax: true,
    default: 50000,
  },
  {
    id: 'bodyStyles',
    title: 'Any body styles you’re drawn to?',
    help: 'Pick as many as you like or keep an open mind.',
    multi: true,
    options: [
      { value: 'hatchback', label: 'Hatchback' },
      { value: 'saloon', label: 'Saloon' },
      { value: 'estate', label: 'Estate or Touring' },
      { value: 'suv', label: 'SUV' },
      { value: 'coupe', label: 'Coupé' },
      { value: 'convertible', label: 'Convertible' },
      { value: 'mpv', label: 'Family carrier' },
      { value: 'any', label: 'No preference', sub: 'Open to any body style' },
    ],
  },
  {
    id: 'fuel',
    title: 'What fuel types suit you?',
    help: 'Pick as many as you like, or let us help you decide.',
    multi: true,
    options: [
      { value: 'petrol', label: 'Petrol' },
      { value: 'diesel', label: 'Diesel', sub: 'Higher miles, more torque' },
      { value: 'phev', label: 'Plug-in hybrid', sub: 'Electric and petrol combined' },
      { value: 'ev', label: 'Fully electric' },
      { value: 'open', label: 'Help me decide', sub: 'Open to any fuel type' },
    ],
  },
  {
    id: 'charging',
    title: 'Could you charge a car at home or work?',
    help: 'A driveway socket or workplace charger changes the electric maths.',
    // fuel is now multi-select (an array), so test membership. Show the charging
    // question if the picks include electric-adjacent fuels or "help me decide",
    // or if fuel is still unanswered. Mirror of SHOW_IF.charging in quiz-meta.js.
    showIf: (a) => {
      const f = a.fuel;
      const picks = Array.isArray(f) ? f : (f != null ? [f] : []);
      return picks.length === 0 || picks.some((v) => v === 'ev' || v === 'phev' || v === 'open');
    },
    options: [
      { value: 'either', label: 'Yes, at home or at work' },
      { value: 'home', label: 'Yes, at home' },
      { value: 'work', label: 'Yes, at work' },
      { value: 'none', label: 'No, I’d rely on public chargers' },
    ],
  },
  {
    id: 'primaryUse',
    title: 'What will this car mostly do?',
    options: [
      { value: 'city', label: 'City driving', sub: 'Short trips, tight parking' },
      { value: 'commute', label: 'The daily commute' },
      { value: 'family', label: 'Family duties', sub: 'School runs and clubs' },
      { value: 'roadtrips', label: 'Long motorway trips' },
      { value: 'fun', label: 'Weekend driving', sub: 'For the enjoyment of it' },
    ],
  },
  {
    id: 'people',
    title: 'Who’s usually on board?',
    options: [
      { value: 'solo', label: 'Just me (plus the odd passenger)' },
      { value: 'family', label: 'A small family', sub: 'Child seats included' },
      { value: 'crew', label: 'A full crew', sub: 'Five or more seats, regularly' },
    ],
  },
  {
    id: 'boot',
    title: 'How much boot space do you need?',
    options: [
      { value: 'small', label: 'Not much', sub: 'A weekend bag will do' },
      { value: 'medium', label: 'A decent amount', sub: 'Weekly shop, buggy, luggage' },
      { value: 'big', label: 'As much as possible', sub: 'Dogs, golf clubs, everything' },
    ],
  },
  {
    id: 'mileage',
    title: 'How many miles a year?',
    help: 'Roughly — it helps us weigh fuel type and running costs.',
    // A number. High-mileage scoring (the diesel/economy boost) kicks in at
    // ≥20,000, matching the old 'vhigh' band — see isHighMileage in engine.js.
    type: 'slider',
    min: 0,
    max: 25000,
    step: 1000,
    format: 'int',
    unit: ' miles',
    plusAtMax: true,
    default: 10000,
  },
  {
    id: 'style',
    title: 'Comfort or sportiness?',
    help: 'Where do you sit between the two?',
    options: [
      { value: '1', label: 'All about comfort' },
      { value: '2', label: 'Mostly comfort' },
      { value: '3', label: 'A bit of both' },
      { value: '4', label: 'Mostly sporty' },
      { value: '5', label: 'Maximum sportiness' },
    ],
  },
  {
    id: 'priorities',
    title: 'Finally, pick your top two priorities.',
    multi: true,
    max: 2,
    options: [
      { value: 'economy', label: 'Running costs' },
      { value: 'performance', label: 'Performance' },
      { value: 'comfort', label: 'Comfort & refinement' },
      { value: 'tech', label: 'Tech & gadgets' },
      { value: 'image', label: 'Style & image' },
    ],
  },
];

/** Budget bands → [min, max] GBP. */
export const BUDGET_BANDS = {
  b1: [0, 35000],
  b2: [35000, 50000],
  b3: [50000, 70000],
  b4: [70000, 100000],
  b5: [100000, 250000],
};
