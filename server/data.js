/*
 * Curated dataset of the current UK BMW range (last reviewed 2026-07; indicative
 * OTR prices, approximate specs — relative positioning matters more than exact numbers).
 *
 * Fields:
 *  body:      hatchback | saloon | estate | suv | coupe | convertible | mpv
 *  fuel:      petrol | diesel | phev | ev
 *  priceMin/priceMax: GBP OTR range for typical trims
 *  sizeClass: 1 (smallest) .. 5 (largest)
 *  boot:      litres, seats up
 *  zeroTo62:  seconds
 *  mpg:       combined mpg (petrol/diesel/phev, petrol-mode-ish)
 *  evRange:   miles (ev/phev electric-only)
 *  tags:      drivers-car | family | cruiser | urban | efficient | tech | image | practical
 */

export const CARS = [
  {
    id: '118', name: 'BMW 118 M Sport', line: '1 Series', body: 'hatchback', fuel: 'petrol',
    priceMin: 32000, priceMax: 38000, monthlyFrom: 380, sizeClass: 1, seats: 5, boot: 380,
    zeroTo62: 8.5, mpg: 48, tags: ['urban', 'efficient'],
    blurb: 'The most affordable way into a BMW, a tidy-handling premium hatchback.',
  },
  {
    id: 'm135', name: 'BMW M135 xDrive', line: '1 Series', body: 'hatchback', fuel: 'petrol',
    priceMin: 43000, priceMax: 48000, monthlyFrom: 520, sizeClass: 1, seats: 5, boot: 380,
    zeroTo62: 4.9, mpg: 38, tags: ['drivers-car', 'urban'],
    blurb: 'A 300-horsepower hot hatch with four-wheel-drive punch in a city-friendly footprint.',
  },
  {
    id: '218at', name: 'BMW 218i Active Tourer', line: '2 Series Active Tourer', body: 'mpv', fuel: 'petrol',
    priceMin: 33000, priceMax: 39000, monthlyFrom: 390, sizeClass: 2, seats: 5, boot: 470,
    zeroTo62: 9.0, mpg: 47, tags: ['family', 'practical', 'urban'],
    blurb: 'The sensible one: a compact family carrier with a big boot and easy access.',
  },
  {
    id: '230eat', name: 'BMW 230e xDrive Active Tourer', line: '2 Series Active Tourer', body: 'mpv', fuel: 'phev',
    priceMin: 42000, priceMax: 47000, monthlyFrom: 480, sizeClass: 2, seats: 5, boot: 406,
    zeroTo62: 5.5, mpg: 250, evRange: 55, tags: ['family', 'practical', 'efficient'],
    blurb: 'Plug-in family MPV: school runs on electric, holidays on petrol.',
  },
  {
    id: '218gc', name: 'BMW 218 Gran Coupé', line: '2 Series Gran Coupé', body: 'saloon', fuel: 'petrol',
    priceMin: 34000, priceMax: 41000, monthlyFrom: 400, sizeClass: 1, seats: 5, boot: 430,
    zeroTo62: 8.6, mpg: 47, tags: ['urban', 'image', 'efficient'],
    blurb: 'A four-door coupé silhouette at hatchback money.',
  },
  {
    id: 'm240', name: 'BMW M240i xDrive Coupé', line: '2 Series Coupé', body: 'coupe', fuel: 'petrol',
    priceMin: 48000, priceMax: 54000, monthlyFrom: 560, sizeClass: 1, seats: 4, boot: 390,
    zeroTo62: 4.3, mpg: 34, tags: ['drivers-car', 'image'],
    blurb: 'Straight-six, rear-biased, compact: the enthusiast bargain of the range.',
  },
  {
    id: 'm2', name: 'BMW M2', line: 'M', body: 'coupe', fuel: 'petrol',
    priceMin: 68000, priceMax: 76000, monthlyFrom: 800, sizeClass: 1, seats: 4, boot: 390,
    zeroTo62: 4.1, mpg: 29, tags: ['drivers-car', 'image'],
    blurb: 'The purist M car: manual available, rear-wheel drive, riotous.',
  },
  {
    id: '320', name: 'BMW 320i Saloon', line: '3 Series', body: 'saloon', fuel: 'petrol',
    priceMin: 45000, priceMax: 52000, monthlyFrom: 490, sizeClass: 2, seats: 5, boot: 480,
    zeroTo62: 7.4, mpg: 44, tags: ['drivers-car', 'cruiser', 'efficient'],
    blurb: 'The default sports saloon, still the benchmark all-rounder.',
  },
  {
    id: '330e-t', name: 'BMW 330e Touring', line: '3 Series', body: 'estate', fuel: 'phev',
    priceMin: 51000, priceMax: 58000, monthlyFrom: 560, sizeClass: 2, seats: 5, boot: 410,
    zeroTo62: 5.9, mpg: 200, evRange: 60, tags: ['family', 'efficient', 'drivers-car', 'practical'],
    blurb: 'Plug-in estate that commutes on electric and still drives like a 3 Series.',
  },
  {
    id: 'm340-t', name: 'BMW M340i xDrive Touring', line: '3 Series', body: 'estate', fuel: 'petrol',
    priceMin: 60000, priceMax: 67000, monthlyFrom: 690, sizeClass: 2, seats: 5, boot: 500,
    zeroTo62: 4.6, mpg: 36, tags: ['drivers-car', 'family', 'practical'],
    blurb: 'A straight-six fast estate, one car that genuinely does everything.',
  },
  {
    id: 'm3-t', name: 'BMW M3 Competition Touring', line: 'M', body: 'estate', fuel: 'petrol',
    priceMin: 92000, priceMax: 102000, monthlyFrom: 1100, sizeClass: 2, seats: 5, boot: 500,
    zeroTo62: 3.6, mpg: 27, tags: ['drivers-car', 'family', 'image'],
    blurb: 'A 500-plus horsepower family estate. The have-it-all M car.',
  },
  {
    id: '420', name: 'BMW 420i Coupé', line: '4 Series', body: 'coupe', fuel: 'petrol',
    priceMin: 49000, priceMax: 56000, monthlyFrom: 540, sizeClass: 2, seats: 4, boot: 440,
    zeroTo62: 7.5, mpg: 44, tags: ['image', 'cruiser', 'drivers-car'],
    blurb: 'Sleek two-door 3 Series with a usable boot and back seats.',
  },
  {
    id: '430c', name: 'BMW 430i Convertible', line: '4 Series', body: 'convertible', fuel: 'petrol',
    priceMin: 58000, priceMax: 64000, monthlyFrom: 640, sizeClass: 2, seats: 4, boot: 385,
    zeroTo62: 6.2, mpg: 40, tags: ['image', 'cruiser'],
    blurb: 'Fabric-roof four-seat convertible for top-down touring.',
  },
  {
    id: 'm4', name: 'BMW M4 Competition xDrive', line: 'M', body: 'coupe', fuel: 'petrol',
    priceMin: 86000, priceMax: 94000, monthlyFrom: 1000, sizeClass: 2, seats: 4, boot: 440,
    zeroTo62: 3.5, mpg: 28, tags: ['drivers-car', 'image'],
    blurb: 'The definitive fast BMW coupé: savage pace, everyday usability.',
  },
  {
    id: 'i4-40', name: 'BMW i4 eDrive40', line: 'i4', body: 'saloon', fuel: 'ev',
    priceMin: 53000, priceMax: 61000, monthlyFrom: 570, sizeClass: 2, seats: 5, boot: 470,
    zeroTo62: 5.7, evRange: 365, tags: ['efficient', 'tech', 'drivers-car'],
    blurb: 'Electric gran coupé with real-world range and proper BMW handling.',
  },
  {
    id: 'i4-m50', name: 'BMW i4 M50 xDrive', line: 'i4', body: 'saloon', fuel: 'ev',
    priceMin: 68000, priceMax: 74000, monthlyFrom: 760, sizeClass: 2, seats: 5, boot: 470,
    zeroTo62: 3.9, evRange: 320, tags: ['drivers-car', 'tech', 'image'],
    blurb: 'M-tuned electric four-door that out-drags most M cars.',
  },
  {
    id: '520', name: 'BMW 520i Saloon', line: '5 Series', body: 'saloon', fuel: 'petrol',
    priceMin: 53000, priceMax: 61000, monthlyFrom: 580, sizeClass: 3, seats: 5, boot: 520,
    zeroTo62: 7.5, mpg: 45, tags: ['cruiser', 'tech', 'efficient'],
    blurb: 'The business-class saloon: refined, huge tech, effortless miles.',
  },
  {
    id: '530e-t', name: 'BMW 530e Touring', line: '5 Series', body: 'estate', fuel: 'phev',
    priceMin: 60000, priceMax: 69000, monthlyFrom: 660, sizeClass: 3, seats: 5, boot: 500,
    zeroTo62: 6.2, mpg: 220, evRange: 60, tags: ['cruiser', 'family', 'efficient', 'practical'],
    blurb: 'Big plug-in estate: electric around town, continental-crusher on holiday.',
  },
  {
    id: 'i5-40t', name: 'BMW i5 eDrive40 Touring', line: 'i5', body: 'estate', fuel: 'ev',
    priceMin: 70000, priceMax: 79000, monthlyFrom: 780, sizeClass: 3, seats: 5, boot: 570,
    zeroTo62: 6.1, evRange: 340, tags: ['tech', 'family', 'cruiser', 'practical', 'efficient'],
    blurb: 'Fully electric executive estate with a properly big boot.',
  },
  {
    id: 'i5-m60', name: 'BMW i5 M60 xDrive', line: 'i5', body: 'saloon', fuel: 'ev',
    priceMin: 98000, priceMax: 106000, monthlyFrom: 1150, sizeClass: 3, seats: 5, boot: 490,
    zeroTo62: 3.8, evRange: 310, tags: ['tech', 'drivers-car', 'image'],
    blurb: 'A near-600-horsepower electric executive express.',
  },
  {
    id: 'm5', name: 'BMW M5', line: 'M', body: 'saloon', fuel: 'phev',
    priceMin: 112000, priceMax: 126000, monthlyFrom: 1350, sizeClass: 3, seats: 5, boot: 466,
    zeroTo62: 3.5, mpg: 27, evRange: 40, tags: ['drivers-car', 'image', 'tech'],
    blurb: 'The hybrid super-saloon: 700-plus horsepower and a silent EV mode.',
  },
  {
    id: '740', name: 'BMW 740d xDrive', line: '7 Series', body: 'saloon', fuel: 'diesel',
    priceMin: 104000, priceMax: 118000, monthlyFrom: 1250, sizeClass: 5, seats: 5, boot: 540,
    zeroTo62: 5.8, mpg: 44, tags: ['cruiser', 'tech', 'image'],
    blurb: 'The luxury flagship, a first-class lounge that does 600 miles a tank.',
  },
  {
    id: 'i7', name: 'BMW i7 xDrive60', line: 'i7', body: 'saloon', fuel: 'ev',
    priceMin: 118000, priceMax: 135000, monthlyFrom: 1400, sizeClass: 5, seats: 5, boot: 500,
    zeroTo62: 4.7, evRange: 380, tags: ['tech', 'cruiser', 'image'],
    blurb: 'Electric limousine with a cinema screen in the back.',
  },
  {
    id: '840gc', name: 'BMW 840i Gran Coupé', line: '8 Series', body: 'coupe', fuel: 'petrol',
    priceMin: 87000, priceMax: 97000, monthlyFrom: 1000, sizeClass: 4, seats: 4, boot: 440,
    zeroTo62: 5.0, mpg: 35, tags: ['image', 'cruiser', 'drivers-car'],
    blurb: 'The glamorous grand tourer: four doors, coupé drama.',
  },
  {
    id: 'x1', name: 'BMW X1 sDrive20i', line: 'X1', body: 'suv', fuel: 'petrol',
    priceMin: 38000, priceMax: 45000, monthlyFrom: 440, sizeClass: 2, seats: 5, boot: 540,
    zeroTo62: 8.3, mpg: 45, tags: ['family', 'practical', 'urban', 'efficient'],
    blurb: 'Compact family SUV with one of the biggest boots in its class.',
  },
  {
    id: 'ix1', name: 'BMW iX1 eDrive20', line: 'iX1', body: 'suv', fuel: 'ev',
    priceMin: 45000, priceMax: 53000, monthlyFrom: 500, sizeClass: 2, seats: 5, boot: 490,
    zeroTo62: 8.6, evRange: 270, tags: ['family', 'urban', 'efficient', 'tech'],
    blurb: 'The electric X1, the easiest first EV in the range.',
  },
  {
    id: 'ix2', name: 'BMW iX2 xDrive30', line: 'iX2', body: 'suv', fuel: 'ev',
    priceMin: 54000, priceMax: 60000, monthlyFrom: 590, sizeClass: 2, seats: 5, boot: 525,
    zeroTo62: 5.6, evRange: 265, tags: ['image', 'urban', 'tech', 'efficient'],
    blurb: 'Coupé-styled electric crossover for standing out on the school run.',
  },
  {
    id: 'x3', name: 'BMW X3 20 xDrive', line: 'X3', body: 'suv', fuel: 'petrol',
    priceMin: 50000, priceMax: 59000, monthlyFrom: 560, sizeClass: 3, seats: 5, boot: 570,
    zeroTo62: 7.8, mpg: 40, tags: ['family', 'practical', 'cruiser'],
    blurb: 'The goldilocks family SUV, big enough for everything, easy to live with.',
  },
  {
    id: 'x3-m50', name: 'BMW X3 M50 xDrive', line: 'X3', body: 'suv', fuel: 'petrol',
    priceMin: 66000, priceMax: 73000, monthlyFrom: 760, sizeClass: 3, seats: 5, boot: 570,
    zeroTo62: 4.6, mpg: 33, tags: ['drivers-car', 'family', 'practical'],
    blurb: 'The family SUV with a straight-six sting in its tail.',
  },
  {
    id: 'ix3', name: 'BMW iX3 50 xDrive', line: 'iX3', body: 'suv', fuel: 'ev',
    priceMin: 59000, priceMax: 70000, monthlyFrom: 660, sizeClass: 3, seats: 5, boot: 520,
    zeroTo62: 4.9, evRange: 460, tags: ['tech', 'family', 'efficient', 'practical'],
    blurb: 'The Neue Klasse flagship: the longest-range, fastest-charging BMW yet.',
  },
  {
    id: 'x5', name: 'BMW X5 xDrive50e', line: 'X5', body: 'suv', fuel: 'phev',
    priceMin: 84000, priceMax: 96000, monthlyFrom: 980, sizeClass: 4, seats: 5, boot: 500,
    zeroTo62: 4.8, mpg: 235, evRange: 60, tags: ['family', 'cruiser', 'image', 'practical'],
    blurb: 'The big plug-in luxury SUV: tows, cruises, and does the school run on electric.',
  },
  {
    id: 'x7', name: 'BMW X7 xDrive40d', line: 'X7', body: 'suv', fuel: 'diesel',
    priceMin: 112000, priceMax: 128000, monthlyFrom: 1300, sizeClass: 5, seats: 7, boot: 750,
    zeroTo62: 5.9, mpg: 36, tags: ['family', 'cruiser', 'image', 'practical'],
    blurb: 'Seven proper seats and limousine luxury, the biggest BMW you can buy.',
  },
  {
    id: 'xm', name: 'BMW XM', line: 'M', body: 'suv', fuel: 'phev',
    priceMin: 150000, priceMax: 168000, monthlyFrom: 1800, sizeClass: 5, seats: 5, boot: 527,
    zeroTo62: 4.1, mpg: 33, evRange: 50, tags: ['image', 'drivers-car', 'tech'],
    blurb: 'The unapologetic M flagship, a 650-horsepower hybrid statement piece.',
  },
  {
    id: 'z4', name: 'BMW Z4 sDrive20i', line: 'Z4', body: 'convertible', fuel: 'petrol',
    priceMin: 46000, priceMax: 56000, monthlyFrom: 520, sizeClass: 1, seats: 2, boot: 281,
    zeroTo62: 6.8, mpg: 40, tags: ['drivers-car', 'image'],
    blurb: 'Two seats, a folding roof, and a sunny B-road. That is the whole point.',
  },
  {
    id: 'ix', name: 'BMW iX xDrive45', line: 'iX', body: 'suv', fuel: 'ev',
    priceMin: 77000, priceMax: 95000, monthlyFrom: 880, sizeClass: 4, seats: 5, boot: 500,
    zeroTo62: 5.1, evRange: 375, tags: ['tech', 'cruiser', 'family', 'image'],
    blurb: 'The electric tech flagship SUV, serene, spacious, and long-legged.',
  },
];
