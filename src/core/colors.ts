export interface Colors 
{
    text: string;

    groundColor: string;
    skyColor: string;

    buildings: string;
    vehicles: string;
    vehiclesHighlight: string;
    
    asphalt: string;
    laneMarkings: string;
    laneMarkingsYellow: string;
    path: string;

    grass: string;
    dirt: string;

    sunPosition: { x: number; y: number; z: number };
    sunColor: string;
    sunIntensity: number;
    fogIntensity: number;
}

const DarkModeColors: Colors = {
    text: "0xeeeeee",
    
    groundColor: "0x272727",
    skyColor: "0x232323",

    buildings: "0x111111",
    vehicles: "0x303030",
    vehiclesHighlight: "0x00d9ff",

    asphalt: "0x232323",
    laneMarkings: "0xbababa",
    laneMarkingsYellow: "0xeed700",
    path: "0x22d9ff",
    
    grass: "0x4caf50",
    dirt: "0x8d6e63",

    sunPosition: { x: 20, y: 0, z: 5 },
    sunColor: "0xffffff",
    sunIntensity: 1,
    fogIntensity: 0.0045,
}

const LightModeColors: Colors = {
    text: "0x222222",

    groundColor: "0xffffff",
    skyColor: "0xe1edf4",

    buildings: "0x444444",
    vehicles: "0x555555",
    vehiclesHighlight: "0x00d9ff",

    asphalt: "0x86939c",
    laneMarkings: "0xffffff",
    laneMarkingsYellow: "0xffd700",
    path: "0x00d9ff",

    grass: "0x4caf50",
    dirt: "0x8d6e63",

    sunPosition: { x: 20, y: 10, z: 5 },
    sunColor: "0xffffff",
    sunIntensity: 6,
    fogIntensity: 0.005,
}

export function getColors(darkMode: boolean): Colors {
    return darkMode ? DarkModeColors : LightModeColors;
}