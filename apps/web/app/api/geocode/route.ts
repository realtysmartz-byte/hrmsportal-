import { NextRequest, NextResponse } from "next/server";

// Comprehensive curated registry of Gurugram / Delhi-NCR builder projects, corporate tech parks & hubs
const POPULAR_HUBS = [
  {
    name: "REALTY SMARTZ PVT LTD (HQ)",
    displayName: "REALTY SMARTZ PVT LTD, Badshahpur, Sector 66, Gurugram, Haryana 122101",
    lat: 28.3997196,
    lng: 77.0385682,
    address: "REALTY SMARTZ PVT LTD, Badshahpur, Sector 66, Gurugram, Haryana 122101",
    tag: "Official HQ Office",
  },
  // M3M Projects
  {
    name: "M3M Urbana",
    displayName: "M3M Urbana, Golf Course Extension Road, Sector 67, Gurugram 122102",
    lat: 28.397521,
    lng: 77.062085,
    address: "M3M Urbana, Sector 67, Golf Course Ext Rd, Gurugram",
    tag: "Commercial Hub",
  },
  {
    name: "M3M Golf Estate",
    displayName: "M3M Golf Estate, Golf Course Extension Rd, Sector 65, Gurugram 122101",
    lat: 28.4011436,
    lng: 77.0664133,
    address: "M3M Golf Estate, Sector 65, Gurugram",
    tag: "Luxury Residential",
  },
  {
    name: "M3M IFC (International Financial Center)",
    displayName: "M3M IFC, Golf Course Extension Road, Sector 66, Gurugram 122002",
    lat: 28.4049117,
    lng: 77.0584264,
    address: "M3M IFC, Sector 66, Gurugram",
    tag: "Corporate Tower",
  },
  {
    name: "M3M Broadway",
    displayName: "M3M Broadway, Golf Course Extension Road, Sector 71, Gurugram 122001",
    lat: 28.392941,
    lng: 77.017832,
    address: "M3M Broadway, Sector 71, Gurugram",
    tag: "Commercial Complex",
  },
  {
    name: "M3M Cosmopolitan",
    displayName: "M3M Cosmopolitan, Golf Course Ext Rd, Sector 66, Gurugram 122001",
    lat: 28.4019442,
    lng: 77.0598657,
    address: "M3M Cosmopolitan, Sector 66, Gurugram",
    tag: "Retail & Offices",
  },
  {
    name: "M3M Corner Walk",
    displayName: "M3M Corner Walk, Sector 74, Gurugram 122004",
    lat: 28.4022405,
    lng: 77.0083793,
    address: "M3M Corner Walk, Sector 74, Gurugram",
    tag: "Commercial Project",
  },
  {
    name: "M3M Skywalk",
    displayName: "M3M Skywalk, Sector 74, SPR Road, Gurugram 122004",
    lat: 28.399512,
    lng: 77.010254,
    address: "M3M Skywalk, Sector 74, Gurugram",
    tag: "Mixed Development",
  },
  {
    name: "M3M Atrium 57",
    displayName: "M3M Atrium 57, Sector 57, Gurugram 122003",
    lat: 28.431201,
    lng: 77.078912,
    address: "M3M Atrium 57, Sector 57, Gurugram",
    tag: "High Street Retail",
  },
  {
    name: "M3M Capital",
    displayName: "M3M Capital, Sector 113, Dwarka Expressway, Gurugram 122017",
    lat: 28.528412,
    lng: 77.031548,
    address: "M3M Capital, Sector 113, Dwarka Expressway, Gurugram",
    tag: "Residential Project",
  },
  {
    name: "M3M Crown",
    displayName: "M3M Crown, Sector 111, Dwarka Expressway, Gurugram 122017",
    lat: 28.531204,
    lng: 77.027891,
    address: "M3M Crown, Sector 111, Dwarka Expressway, Gurugram",
    tag: "Luxury Project",
  },
  {
    name: "M3M Antalya Hills",
    displayName: "M3M Antalya Hills, Sector 79, Gurugram 122004",
    lat: 28.361521,
    lng: 76.989214,
    address: "M3M Antalya Hills, Sector 79, Gurugram",
    tag: "Hillside Homes",
  },
  {
    name: "M3M Jewel",
    displayName: "M3M Jewel, Sector 25, MG Road, Gurugram 122002",
    lat: 28.483912,
    lng: 77.086411,
    address: "M3M Jewel, Sector 25, MG Road, Gurugram",
    tag: "Luxury Retail",
  },
  {
    name: "M3M Route 65",
    displayName: "M3M Route 65, Sector 65, Golf Course Ext Rd, Gurugram 122101",
    lat: 28.404121,
    lng: 77.068914,
    address: "M3M Route 65, Sector 65, Gurugram",
    tag: "High Street Commercial",
  },
  {
    name: "M3M Soulitude",
    displayName: "M3M Soulitude, Sector 89, New Gurugram 122505",
    lat: 28.409514,
    lng: 76.941205,
    address: "M3M Soulitude, Sector 89, Gurugram",
    tag: "Low Rise Floors",
  },
  {
    name: "M3M Merlin",
    displayName: "M3M Merlin, Sector 67, Golf Course Ext Rd, Gurugram 122102",
    lat: 28.396102,
    lng: 77.059412,
    address: "M3M Merlin, Sector 67, Gurugram",
    tag: "Singapore Style Residences",
  },
  {
    name: "M3M Woodshire",
    displayName: "M3M Woodshire, Sector 107, Dwarka Expressway, Gurugram 122006",
    lat: 28.514211,
    lng: 76.994512,
    address: "M3M Woodshire, Sector 107, Gurugram",
    tag: "Residential Complex",
  },
  {
    name: "M3M Heights",
    displayName: "M3M Heights, Sector 65, Golf Course Ext Rd, Gurugram 122101",
    lat: 28.402511,
    lng: 77.067124,
    address: "M3M Heights, Sector 65, Gurugram",
    tag: "Tower Living",
  },
  {
    name: "M3M Skylofts",
    displayName: "M3M Skylofts, Sector 71, SPR, Gurugram 122001",
    lat: 28.393112,
    lng: 77.018412,
    address: "M3M Skylofts, Sector 71, Gurugram",
    tag: "Service Apartments",
  },
  {
    name: "M3M Tee Point",
    displayName: "M3M Tee Point, Vikas Marg, Sector 66, Gurugram 122001",
    lat: 28.3943576,
    lng: 77.0303276,
    address: "M3M Tee Point, Sector 66, Gurugram",
    tag: "Commercial Retail",
  },
  {
    name: "M3M Prive 73",
    displayName: "M3M Prive 73, Sector 73, SPR Road, Gurugram 122004",
    lat: 28.396541,
    lng: 77.015214,
    address: "M3M Prive 73, Sector 73, Gurugram",
    tag: "Mall & Retail",
  },
  {
    name: "M3M Sierra 68",
    displayName: "M3M Sierra 68, Sector 68, Sohna Road, Gurugram 122101",
    lat: 28.384512,
    lng: 77.045214,
    address: "M3M Sierra 68, Sector 68, Gurugram",
    tag: "Residential",
  },
  {
    name: "M3M Marina",
    displayName: "M3M Marina, Sector 68, Sohna Road, Gurugram 122101",
    lat: 28.386124,
    lng: 77.047125,
    address: "M3M Marina, Sector 68, Gurugram",
    tag: "Waterfront Living",
  },
  {
    name: "M3M Escala",
    displayName: "M3M Escala, Sector 70A, SPR Road, Gurugram 122101",
    lat: 28.389512,
    lng: 77.025412,
    address: "M3M Escala, Sector 70A, Gurugram",
    tag: "Condominium",
  },

  // DLF Projects
  {
    name: "DLF Cyber City",
    displayName: "DLF Cyber City, DLF Phase 2, Sector 24, Gurugram 122002",
    lat: 28.4906,
    lng: 77.0898,
    address: "DLF Cyber City, DLF Phase 2, Gurugram",
    tag: "Tech Park",
  },
  {
    name: "DLF Cyber Hub",
    displayName: "DLF Cyber Hub, DLF Phase 2, Gurugram 122002",
    lat: 28.4952,
    lng: 77.0886,
    address: "DLF Cyber Hub, Gurugram",
    tag: "Dining & Commercial",
  },
  {
    name: "DLF Downtown",
    displayName: "DLF Downtown, Sector 25A, DLF Phase 3, Gurugram 122002",
    lat: 28.4912,
    lng: 77.0945,
    address: "DLF Downtown, Sector 25A, Gurugram",
    tag: "Grade A Offices",
  },
  {
    name: "DLF Horizon Center",
    displayName: "One Horizon Center, Golf Course Road, Sector 43, Gurugram 122002",
    lat: 28.4725,
    lng: 77.0968,
    address: "One Horizon Center, Golf Course Rd, Gurugram",
    tag: "Corporate Towers",
  },
  {
    name: "Two Horizon Center",
    displayName: "Two Horizon Center, Golf Course Road, Sector 43, Gurugram 122002",
    lat: 28.4718,
    lng: 77.0975,
    address: "Two Horizon Center, Golf Course Rd, Gurugram",
    tag: "Corporate Towers",
  },
  {
    name: "DLF The Camellias",
    displayName: "DLF The Camellias, Golf Course Road, Sector 42, Gurugram 122002",
    lat: 28.4682,
    lng: 77.0984,
    address: "DLF Camellias, Sector 42, Gurugram",
    tag: "Ultra Luxury",
  },
  {
    name: "DLF The Magnolias",
    displayName: "DLF The Magnolias, Sector 42, Golf Course Road, Gurugram 122002",
    lat: 28.4645,
    lng: 77.0991,
    address: "DLF Magnolias, Sector 42, Gurugram",
    tag: "Luxury Living",
  },
  {
    name: "DLF The Crest",
    displayName: "DLF The Crest, Sector 54, Golf Course Road, Gurugram 122011",
    lat: 28.4552,
    lng: 77.1021,
    address: "DLF The Crest, Sector 54, Gurugram",
    tag: "Residential",
  },
  {
    name: "DLF Galleria Market",
    displayName: "DLF Galleria Market, DLF Phase 4, Sector 28, Gurugram 122009",
    lat: 28.4674,
    lng: 77.0825,
    address: "Galleria Market, DLF Phase 4, Gurugram",
    tag: "Commercial Market",
  },
  {
    name: "DLF South Point Mall",
    displayName: "South Point Mall, Golf Course Road, Sector 53, Gurugram 122002",
    lat: 28.4601,
    lng: 77.0995,
    address: "South Point Mall, Sector 53, Gurugram",
    tag: "Shopping Mall",
  },

  // AIPL Projects
  {
    name: "AIPL Joy Central",
    displayName: "AIPL Joy Central, Sector 65, Golf Course Ext Rd, Gurugram 122101",
    lat: 28.4062,
    lng: 77.0641,
    address: "AIPL Joy Central, Sector 65, Gurugram",
    tag: "Commercial Retail",
  },
  {
    name: "AIPL Joy Street",
    displayName: "AIPL Joy Street, Sector 66, Golf Course Ext Rd, Gurugram 122101",
    lat: 28.4035,
    lng: 77.0542,
    address: "AIPL Joy Street, Sector 66, Gurugram",
    tag: "Retail & Offices",
  },
  {
    name: "AIPL Business Club",
    displayName: "AIPL Business Club, Sector 62, Golf Course Ext Rd, Gurugram 122011",
    lat: 28.4112,
    lng: 77.0725,
    address: "AIPL Business Club, Sector 62, Gurugram",
    tag: "Corporate Park",
  },
  {
    name: "AIPL Joy Gallery",
    displayName: "AIPL Joy Gallery, Sector 66, Golf Course Ext Rd, Gurugram 122101",
    lat: 28.4021,
    lng: 77.0561,
    address: "AIPL Joy Gallery, Sector 66, Gurugram",
    tag: "High Street Retail",
  },

  // Emaar Projects
  {
    name: "Emaar Palm Drive",
    displayName: "Emaar The Palm Drive, Golf Course Ext Rd, Sector 66, Gurugram 122002",
    lat: 28.4018,
    lng: 77.0519,
    address: "Emaar Palm Drive, Sector 66, Gurugram",
    tag: "Luxury Residential",
  },
  {
    name: "Emaar Emerald Hills",
    displayName: "Emaar Emerald Hills, Sector 65, Golf Course Ext Rd, Gurugram 122101",
    lat: 28.4055,
    lng: 77.0612,
    address: "Emaar Emerald Hills, Sector 65, Gurugram",
    tag: "Township",
  },
  {
    name: "Emaar Marbella",
    displayName: "Emaar Marbella Villas, Sector 66, Gurugram 122018",
    lat: 28.4011,
    lng: 77.0554,
    address: "Emaar Marbella, Sector 66, Gurugram",
    tag: "Luxury Villas",
  },
  {
    name: "Emaar Palm Springs",
    displayName: "Emaar Palm Springs, Sector 54, Golf Course Road, Gurugram 122002",
    lat: 28.4582,
    lng: 77.1012,
    address: "Emaar Palm Springs, Sector 54, Gurugram",
    tag: "Luxury Gated",
  },
  {
    name: "Emaar Digi Homes",
    displayName: "Emaar Digi Homes, Sector 62, Golf Course Ext Rd, Gurugram 122102",
    lat: 28.4145,
    lng: 77.0742,
    address: "Emaar Digi Homes, Sector 62, Gurugram",
    tag: "Smart Homes",
  },

  // Central Park Projects
  {
    name: "Central Park Resorts",
    displayName: "Central Park Resorts, Sector 48, Sohna Road, Gurugram 122018",
    lat: 28.4234,
    lng: 77.0389,
    address: "Central Park Resorts, Sector 48, Gurugram",
    tag: "Luxury Township",
  },
  {
    name: "Central Park Flower Valley",
    displayName: "Central Park Flower Valley, Sector 32-33, Sohna, Gurugram 122103",
    lat: 28.2612,
    lng: 77.0645,
    address: "Central Park Flower Valley, Sohna, Gurugram",
    tag: "Mega Township",
  },

  // Tulip Projects
  {
    name: "Tulip Violet",
    displayName: "Tulip Violet, Sector 69, Southern Peripheral Rd, Gurugram 122101",
    lat: 28.3961,
    lng: 77.0315,
    address: "Tulip Violet, Sector 69, Gurugram",
    tag: "Residential",
  },
  {
    name: "Tulip Purple",
    displayName: "Tulip Purple, Sector 69, Gurugram, Haryana 122101",
    lat: 28.3957338,
    lng: 77.0325482,
    address: "Tulip Purple, Sector 69, Gurugram",
    tag: "Residential",
  },
  {
    name: "Tulip Orange",
    displayName: "Tulip Orange, Sector 70, Southern Peripheral Rd, Gurugram 122101",
    lat: 28.3947786,
    lng: 77.0288951,
    address: "Tulip Orange, Sector 70, Gurugram",
    tag: "Residential",
  },
  {
    name: "Tulip Ivory",
    displayName: "Tulip Ivory, Sector 70, Gurugram, Haryana 122101",
    lat: 28.3941047,
    lng: 77.0288254,
    address: "Tulip Ivory, Sector 70, Gurugram",
    tag: "Residential",
  },
  {
    name: "Tulip Ace",
    displayName: "Tulip Ace, Sector 89, New Gurugram 122505",
    lat: 28.4256897,
    lng: 76.9442995,
    address: "Tulip Ace, Sector 89, Gurugram",
    tag: "Residential",
  },
  {
    name: "Tulip Lemon",
    displayName: "Tulip Lemon, Sector 69, Gurugram, Haryana 122101",
    lat: 28.3939594,
    lng: 77.0325343,
    address: "Tulip Lemon, Sector 69, Gurugram",
    tag: "Residential",
  },
  {
    name: "Tulip White",
    displayName: "Tulip White, Sector 69, SPR Road, Gurugram 122101",
    lat: 28.3972,
    lng: 77.0331,
    address: "Tulip White, Sector 69, Gurugram",
    tag: "Residential",
  },

  // Vatika Projects
  {
    name: "Vatika Business Park",
    displayName: "Vatika Business Park, Sector 49, Sohna Road, Gurugram 122018",
    lat: 28.4057599,
    lng: 77.0447882,
    address: "Vatika Business Park, Sector 49, Gurugram",
    tag: "Corporate Park",
  },
  {
    name: "Vatika City",
    displayName: "Vatika City, Sector 49, Sohna Road, Gurugram 122018",
    lat: 28.404382,
    lng: 77.0475994,
    address: "Vatika City, Sector 49, Gurugram",
    tag: "Township",
  },
  {
    name: "Vatika India Next (INXT)",
    displayName: "Vatika India Next, Sector 82/83, NH-8, New Gurugram 122004",
    lat: 28.3952,
    lng: 76.9612,
    address: "Vatika INXT, Sector 82, Gurugram",
    tag: "Township",
  },
  {
    name: "Vatika Towers",
    displayName: "Vatika Towers, Sector 54, Golf Course Road, Gurugram 122002",
    lat: 28.4521,
    lng: 77.1045,
    address: "Vatika Towers, Golf Course Rd, Gurugram",
    tag: "Commercial Offices",
  },

  // Bestech Projects
  {
    name: "Bestech Business Tower",
    displayName: "Bestech Business Tower, Sector 48, Sohna Road, Gurugram 122018",
    lat: 28.4215,
    lng: 77.0412,
    address: "Bestech Business Tower, Sector 48, Gurugram",
    tag: "IT Park",
  },
  {
    name: "Bestech Park View Spa Next",
    displayName: "Bestech Park View Spa Next, Sector 67, Gurugram 122101",
    lat: 28.3921,
    lng: 77.0612,
    address: "Bestech Spa Next, Sector 67, Gurugram",
    tag: "Residential",
  },
  {
    name: "Bestech Park View City 1",
    displayName: "Bestech Park View City 1, Sector 48, Sohna Road, Gurugram 122018",
    lat: 28.4245,
    lng: 77.0365,
    address: "Bestech Park View City 1, Sector 48, Gurugram",
    tag: "Residential",
  },

  // Ireo Projects
  {
    name: "Ireo Skyon",
    displayName: "Ireo Skyon, Sector 60, Golf Course Extension Rd, Gurugram 122102",
    lat: 28.4065,
    lng: 77.0851,
    address: "Ireo Skyon, Sector 60, Gurugram",
    tag: "Smart Residences",
  },
  {
    name: "Ireo Grand Arch",
    displayName: "Ireo The Grand Arch, Sector 58, Golf Course Ext Rd, Gurugram 122102",
    lat: 28.4115,
    lng: 77.0912,
    address: "Ireo Grand Arch, Sector 58, Gurugram",
    tag: "Luxury Residential",
  },
  {
    name: "Ireo Victory Valley",
    displayName: "Ireo Victory Valley, Sector 67, Golf Course Ext Rd, Gurugram 122102",
    lat: 28.3942,
    lng: 77.0645,
    address: "Ireo Victory Valley, Sector 67, Gurugram",
    tag: "Skyscraper Living",
  },
  {
    name: "Ireo Uptown",
    displayName: "Ireo Uptown, Sector 66, Golf Course Extension Rd, Gurugram 122001",
    lat: 28.3985,
    lng: 77.0541,
    address: "Ireo Uptown, Sector 66, Gurugram",
    tag: "Residential",
  },

  // Spaze Projects
  {
    name: "Spaze i-Tech Park",
    displayName: "Spaze i-Tech Park, Sector 49, Sohna Road, Gurugram 122018",
    lat: 28.4145,
    lng: 77.0421,
    address: "Spaze i-Tech Park, Sector 49, Gurugram",
    tag: "Commercial Offices",
  },
  {
    name: "Spaze Edge",
    displayName: "Spaze Edge, Sector 47, Sohna Road, Gurugram 122018",
    lat: 28.4265,
    lng: 77.0435,
    address: "Spaze Edge, Sector 47, Gurugram",
    tag: "Commercial Complex",
  },

  // Elan Projects
  {
    name: "Elan Miracle",
    displayName: "Elan Miracle, Sector 84, Dwarka Expressway, Gurugram 122004",
    lat: 28.4012,
    lng: 76.9685,
    address: "Elan Miracle, Sector 84, Gurugram",
    tag: "Mall & Multiplex",
  },
  {
    name: "Elan Epic",
    displayName: "Elan Epic, Sector 70, Southern Peripheral Rd, Gurugram 122101",
    lat: 28.3965,
    lng: 77.0245,
    address: "Elan Epic, Sector 70, Gurugram",
    tag: "Luxury Commercial",
  },
  {
    name: "Elan Town Centre",
    displayName: "Elan Town Centre, Sector 67, Sohna Road, Gurugram 122101",
    lat: 28.3982,
    lng: 77.0495,
    address: "Elan Town Centre, Sector 67, Gurugram",
    tag: "High Street Retail",
  },

  // Signature Global Projects
  {
    name: "Signature Global City 63A",
    displayName: "Signature Global City 63A, Sector 63A, Gurugram 122102",
    lat: 28.4015,
    lng: 77.0812,
    address: "Signature Global City 63A, Gurugram",
    tag: "Premium Floors",
  },
  {
    name: "Signature Global Solera",
    displayName: "Signature Global Solera, Sector 107, Dwarka Expressway, Gurugram 122006",
    lat: 28.5112,
    lng: 76.9915,
    address: "Signature Global Solera, Sector 107, Gurugram",
    tag: "Residential",
  },
  {
    name: "Signature Global Park Sohna",
    displayName: "Signature Global Park, Sector 36, Sohna, Gurugram 122103",
    lat: 28.2585,
    lng: 77.0512,
    address: "Signature Global Park, Sohna, Gurugram",
    tag: "Township",
  },

  // Godrej Projects
  {
    name: "Godrej Frontier",
    displayName: "Godrej Frontier, Sector 80, NH-8, Gurugram 122004",
    lat: 28.3685,
    lng: 76.9712,
    address: "Godrej Frontier, Sector 80, Gurugram",
    tag: "Residential",
  },
  {
    name: "Godrej Summit",
    displayName: "Godrej Summit, Sector 104, Dwarka Expressway, Gurugram 122006",
    lat: 28.4985,
    lng: 77.0012,
    address: "Godrej Summit, Sector 104, Gurugram",
    tag: "Luxury Condos",
  },
  {
    name: "Godrej Air",
    displayName: "Godrej Air, Sector 85, New Gurugram 122004",
    lat: 28.4025,
    lng: 76.9585,
    address: "Godrej Air, Sector 85, Gurugram",
    tag: "Residential",
  },

  // Tata Projects
  {
    name: "Tata Primanti",
    displayName: "Tata Primanti, Sector 72, Southern Peripheral Rd, Gurugram 122101",
    lat: 28.3985,
    lng: 77.0212,
    address: "Tata Primanti, Sector 72, Gurugram",
    tag: "Luxury Township",
  },
  {
    name: "Tata Raisina Residency",
    displayName: "Tata Raisina Residency, Sector 59, Golf Course Ext Rd, Gurugram 122102",
    lat: 28.4112,
    lng: 77.0985,
    address: "Tata Raisina Residency, Sector 59, Gurugram",
    tag: "Residential",
  },

  // Whiteland Projects
  {
    name: "Whiteland The Aspen",
    displayName: "Whiteland The Aspen, Sector 76, SPR, Gurugram 122004",
    lat: 28.3845,
    lng: 76.9852,
    address: "Whiteland The Aspen, Sector 76, Gurugram",
    tag: "Luxury High Rise",
  },
  {
    name: "Whiteland Blissville",
    displayName: "Whiteland Blissville, Sector 76, Gurugram 122004",
    lat: 28.3821,
    lng: 76.9881,
    address: "Whiteland Blissville, Sector 76, Gurugram",
    tag: "Low Rise Floors",
  },

  // Smartworld Projects
  {
    name: "Smartworld Orchard",
    displayName: "Smartworld Orchard, Sector 61, Golf Course Ext Rd, Gurugram 122102",
    lat: 28.4125,
    lng: 77.0815,
    address: "Smartworld Orchard, Sector 61, Gurugram",
    tag: "Low Rise Living",
  },
  {
    name: "Smartworld Gems",
    displayName: "Smartworld Gems, Sector 89, New Gurugram 122505",
    lat: 28.4152,
    lng: 76.9421,
    address: "Smartworld Gems, Sector 89, Gurugram",
    tag: "Residential",
  },

  // Pioneer Urban Projects
  {
    name: "Pioneer Araya",
    displayName: "Pioneer Araya, Sector 62, Golf Course Ext Rd, Gurugram 122102",
    lat: 28.4121,
    lng: 77.0695,
    address: "Pioneer Araya, Sector 62, Gurugram",
    tag: "Ultra Luxury",
  },
  {
    name: "Pioneer Urban Square",
    displayName: "Pioneer Urban Square, Sector 62, Golf Course Ext Rd, Gurugram 122102",
    lat: 28.4105,
    lng: 77.0712,
    address: "Pioneer Urban Square, Sector 62, Gurugram",
    tag: "Commercial Offices",
  },

  // Prominent Tech & Commercial Centers
  {
    name: "Good Earth City Centre",
    displayName: "Good Earth City Centre, Sector 50, Gurugram 122018",
    lat: 28.4162,
    lng: 77.0585,
    address: "Good Earth City Centre, Sector 50, Gurugram",
    tag: "Commercial & Retail",
  },
  {
    name: "Ardee Mall",
    displayName: "Ardee Mall, Ardee City, Sector 52, Gurugram 122003",
    lat: 28.4452,
    lng: 77.0785,
    address: "Ardee Mall, Sector 52, Gurugram",
    tag: "Shopping Mall",
  },
  {
    name: "Airia Mall",
    displayName: "Airia Mall, Sector 68, Sohna Road, Gurugram 122101",
    lat: 28.3812,
    lng: 77.0425,
    address: "Airia Mall, Sector 68, Gurugram",
    tag: "Shopping Mall",
  },
  {
    name: "Unitech Cyber Park",
    displayName: "Unitech Cyber Park, Sector 39, Gurugram 122003",
    lat: 28.4525,
    lng: 77.0542,
    address: "Unitech Cyber Park, Sector 39, Gurugram",
    tag: "IT Tech Park",
  },
  {
    name: "Unitech Signature Towers",
    displayName: "Signature Towers, South City 1, Sector 30, Gurugram 122001",
    lat: 28.4715,
    lng: 77.0585,
    address: "Signature Towers, Sector 30, Gurugram",
    tag: "Corporate Tower",
  },
  {
    name: "JMD Megapolis",
    displayName: "JMD Megapolis, Sector 48, Sohna Road, Gurugram 122018",
    lat: 28.4185,
    lng: 77.0395,
    address: "JMD Megapolis, Sector 48, Gurugram",
    tag: "IT & Tech Park",
  },
  {
    name: "JMD Regent Square",
    displayName: "JMD Regent Square, MG Road, DLF Phase 2, Gurugram 122002",
    lat: 28.4812,
    lng: 77.0915,
    address: "JMD Regent Square, MG Road, Gurugram",
    tag: "Commercial",
  },
  {
    name: "Baani City Center",
    displayName: "Baani City Center, Sector 66, Golf Course Ext Rd, Gurugram 122018",
    lat: 28.3995,
    lng: 77.0575,
    address: "Baani City Center, Sector 66, Gurugram",
    tag: "Retail & Offices",
  },
  {
    name: "Paras Trinity",
    displayName: "Paras Trinity, Sector 63, Golf Course Ext Rd, Gurugram 122011",
    lat: 28.4045,
    lng: 77.0785,
    address: "Paras Trinity, Sector 63, Gurugram",
    tag: "Retail & Offices",
  },
  {
    name: "Vipul Tech Square",
    displayName: "Vipul Tech Square, Golf Course Road, Sector 43, Gurugram 122002",
    lat: 28.4651,
    lng: 77.0942,
    address: "Vipul Tech Square, Sector 43, Gurugram",
    tag: "IT Park",
  },
  {
    name: "Krisumi Waterfall Residences",
    displayName: "Krisumi Waterfall Residences, Sector 36A, CPR, Gurugram 122004",
    lat: 28.4112,
    lng: 76.9745,
    address: "Krisumi Waterfall Residences, Sector 36A, Gurugram",
    tag: "Japanese Luxury",
  },
  {
    name: "Omaxe Celebration Mall",
    displayName: "Omaxe Celebration Mall, Subhash Chowk, Sector 48, Gurugram 122001",
    lat: 28.4285,
    lng: 77.0392,
    address: "Omaxe Celebration Mall, Subhash Chowk, Gurugram",
    tag: "Commercial Mall",
  },
  {
    name: "Omaxe Chowk",
    displayName: "Omaxe Chowk, Chandni Chowk, Delhi 110006",
    lat: 28.6562,
    lng: 77.2307,
    address: "Chandni Chowk, Old Delhi",
    tag: "Commercial Center",
  },
];

// Helper to extract coordinates from Google Maps URLs or direct lat,lng strings
function parseCoordinatesFromQuery(query: string): { lat: number; lng: number; label: string } | null {
  const q = query.trim();

  // Pattern 1: Google Maps URL containing @lat,lng or place/.../@lat,lng
  const gmapUrlMatch = q.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (gmapUrlMatch) {
    const lat = parseFloat(gmapUrlMatch[1]);
    const lng = parseFloat(gmapUrlMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng, label: "Google Maps Pinpoint" };
    }
  }

  // Pattern 2: ?q=lat,lng or destination=lat,lng or query=lat,lng
  const paramMatch = q.match(/[?&](?:q|query|destination|ll|saddr|daddr)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (paramMatch) {
    const lat = parseFloat(paramMatch[1]);
    const lng = parseFloat(paramMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng, label: "Google Maps Coordinate Link" };
    }
  }

  // Pattern 3: Direct lat, lng string like "28.3997, 77.0385" or "28.3997196 77.0385682"
  const directCoordMatch = q.match(/^(-?\d{1,2}\.\d+)[,\s]+(-?\d{1,3}\.\d+)$/);
  if (directCoordMatch) {
    const lat = parseFloat(directCoordMatch[1]);
    const lng = parseFloat(directCoordMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng, label: `Custom Coordinates (${lat.toFixed(5)}, ${lng.toFixed(5)})` };
    }
  }

  return null;
}

interface GeocodeItem {
  name: string;
  displayName: string;
  lat: number;
  lng: number;
  address: string;
  tag?: string;
}

/**
 * Fetch micro-locations (every society, building, chowk, sector, market) from Komoot Photon
 * with location proximity scoring centered around Gurugram / Delhi-NCR (28.3997, 77.0385)
 */
async function fetchFromPhoton(query: string): Promise<GeocodeItem[]> {
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(
      query
    )}&lat=28.3997&lon=77.0385&limit=15`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(3500),
      headers: {
        Accept: "application/json",
      },
      next: { revalidate: 60 },
    });

    if (!res.ok) return [];

    const json = (await res.json()) as {
      features?: Array<{
        properties?: {
          name?: string;
          street?: string;
          housenumber?: string;
          district?: string;
          locality?: string;
          city?: string;
          state?: string;
          postcode?: string;
          type?: string;
          osm_value?: string;
          osm_key?: string;
        };
        geometry?: {
          coordinates?: [number, number]; // [lon, lat]
        };
      }>;
    };

    if (!json.features || !Array.isArray(json.features)) return [];

    return json.features
      .filter((f) => f.geometry?.coordinates && f.geometry.coordinates.length === 2)
      .map((f) => {
        const p = f.properties || {};
        const coords = f.geometry!.coordinates!;
        const lng = coords[0];
        const lat = coords[1];

        const rawName = p.name || p.street || p.district || "Location";
        const parts = [
          p.name,
          p.housenumber,
          p.street,
          p.district,
          p.locality,
          p.city,
          p.state,
        ].filter(Boolean) as string[];

        // Remove adjacent duplicates e.g. "Gurgaon, Gurgaon"
        const cleanParts = parts.filter((val, i, arr) => arr.indexOf(val) === i);
        const displayName = cleanParts.slice(0, 4).join(", ") || rawName;

        let tag = (p.osm_value || p.type || "SITE").toUpperCase();
        if (tag === "YES" || tag === "HOUSE") tag = "RESIDENTIAL";
        if (tag === "MALL" || tag === "SHOP") tag = "COMMERCIAL";

        return {
          name: rawName.slice(0, 70),
          displayName: displayName.slice(0, 140),
          lat: Number(lat),
          lng: Number(lng),
          address: displayName.slice(0, 150),
          tag: tag.slice(0, 14),
        };
      });
  } catch {
    return [];
  }
}

/**
 * Fetch fallback from OpenStreetMap Nominatim with viewbox bias for Delhi-NCR
 */
async function fetchFromNominatim(query: string): Promise<GeocodeItem[]> {
  try {
    let effectiveQuery = query;
    if (/^(sec|sector)\s*\d+/i.test(query) && !/gurugram|gurgaon|delhi|haryana/i.test(query)) {
      effectiveQuery = `${query}, Gurugram, Haryana`;
    }

    const searchUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
      effectiveQuery
    )}&countrycodes=in&viewbox=76.80,28.62,77.28,28.25&bounded=0&limit=8&addressdetails=1`;

    const res = await fetch(searchUrl, {
      signal: AbortSignal.timeout(3500),
      headers: {
        "User-Agent": "RealtySmartzHRMS/1.0 (internal-hr; contact@realtysmartz.in)",
        Accept: "application/json",
      },
      next: { revalidate: 60 },
    });

    if (!res.ok) return [];

    const data = (await res.json()) as Array<{
      name?: string;
      display_name: string;
      lat: string;
      lon: string;
      type?: string;
    }>;

    return data.map((item) => {
      const rawName = item.name || item.display_name.split(",")[0].trim();
      const parts = item.display_name.split(",").map((s) => s.trim());
      const cleanShort = parts.slice(0, 4).join(", ");
      return {
        name: rawName.slice(0, 70),
        displayName: cleanShort.slice(0, 140),
        lat: Number(item.lat),
        lng: Number(item.lon),
        address: cleanShort.slice(0, 150),
        tag: item.type ? item.type.toUpperCase().slice(0, 14) : "LOCATION",
      };
    });
  } catch {
    return [];
  }
}

/**
 * Handles:
 * 1. Forward Geocoding / Search Autocomplete: ?q=<search_text>
 *    - Exact Google Maps links & GPS coordinates parsed instantly
 *    - Curated registry of 75+ prominent NCR builder projects & tech parks
 *    - Photon hyper-local geocoder (extracts every micro-society, sector, chowk, building)
 *    - OpenStreetMap Nominatim with viewbox fallback
 * 2. Reverse Geocoding: ?lat=<number>&lng=<number>
 */
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim();
  const lat = req.nextUrl.searchParams.get("lat");
  const lng = req.nextUrl.searchParams.get("lng");

  // CASE 1: Location search / autocomplete
  if (query) {
    const qLower = query.toLowerCase();

    // 1. Direct coordinate or Google Maps URL parsing
    const directCoords = parseCoordinatesFromQuery(query);
    const directMatch: GeocodeItem[] = directCoords
      ? [
          {
            name: directCoords.label,
            displayName: `${directCoords.label} [${directCoords.lat.toFixed(5)}, ${directCoords.lng.toFixed(5)}]`,
            lat: directCoords.lat,
            lng: directCoords.lng,
            address: `Coordinates: ${directCoords.lat.toFixed(6)}, ${directCoords.lng.toFixed(6)}`,
            tag: "Exact GPS Pin",
          },
        ]
      : [];

    // 2. Curated instant local registry match
    const localMatches: GeocodeItem[] = POPULAR_HUBS.filter((h) => {
      const name = h.name.toLowerCase();
      const disp = h.displayName.toLowerCase();
      const addr = h.address.toLowerCase();

      // Check if user is searching for multiple tokens e.g. "m3m 65" or "aipl 66"
      const words = qLower.split(/[\s,]+/).filter((w) => w.length > 1);
      if (words.length > 1) {
        return words.every((w) => name.includes(w) || disp.includes(w) || addr.includes(w));
      }
      return name.includes(qLower) || disp.includes(qLower) || addr.includes(qLower);
    });

    // 3. Parallel fetch: Photon (hyper-local micro locations) + Nominatim (all India fallback)
    const [photonSettled, nominatimSettled] = await Promise.allSettled([
      fetchFromPhoton(query),
      fetchFromNominatim(query),
    ]);

    const photonMatches = photonSettled.status === "fulfilled" ? photonSettled.value : [];
    const nominatimMatches = nominatimSettled.status === "fulfilled" ? nominatimSettled.value : [];

    // Combine in priority order: Direct GPS Pin -> Curated Projects -> Photon Micro-Sites -> Nominatim
    const combined = [...directMatch, ...localMatches, ...photonMatches, ...nominatimMatches];

    // Deduplicate items that have nearly identical coordinates (~100m) or identical names
    const unique = new Map<string, GeocodeItem>();

    for (const item of combined) {
      // Key on rounded coordinates (3 decimal places ~ 110 meters) + normalized name prefix
      const normName = item.name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
      const geoKey = `${item.lat.toFixed(3)}_${item.lng.toFixed(3)}_${normName}`;

      if (!unique.has(geoKey)) {
        unique.set(geoKey, item);
      }
    }

    return NextResponse.json({
      results: Array.from(unique.values()).slice(0, 18),
    });
  }

  // CASE 2: Reverse geocode with lat and lng
  if (!lat || !lng) {
    return NextResponse.json(
      { error: "Provide either ?q=<search> or ?lat=<lat>&lng=<lng>" },
      { status: 400 }
    );
  }

  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(4000),
      headers: {
        "User-Agent": "RealtySmartzHRMS/1.0 (internal-hr; contact@realtysmartz.in)",
        Accept: "application/json",
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Geocoding provider error" }, { status: 502 });
    }

    const data = (await res.json()) as {
      display_name?: string;
      name?: string;
      address?: Record<string, string>;
    };

    const addr = data.address ?? {};
    let placeName =
      data.name ||
      addr.building ||
      addr.amenity ||
      addr.office ||
      addr.shop ||
      addr.road ||
      addr.neighbourhood ||
      addr.suburb ||
      addr.village ||
      addr.town ||
      addr.city ||
      "Realty Smartz Private Limited";

    let address = data.display_name || `${lat}, ${lng}`;

    if (!placeName || /sunbreeze/i.test(placeName) || placeName === "Current location") {
      placeName = "Realty Smartz Private Limited";
    }

    if (/sunbreeze/i.test(address)) {
      address = address.replace(/sunbreeze/gi, "Realty Smartz Private Limited");
    }

    return NextResponse.json({
      name: placeName.slice(0, 70),
      address: address.slice(0, 150),
      lat: Number(lat),
      lng: Number(lng),
    });
  } catch {
    return NextResponse.json({ error: "Failed to contact geocoding provider" }, { status: 502 });
  }
}
