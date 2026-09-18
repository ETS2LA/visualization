export interface Colors 
{
    text: string;

    groundColor: string;
    skyColor: string;

    buildings: string;
    vehicles: string;
    
    asphalt: string;
    prefabAsphalt: string;
    laneMarkings: string;
    laneMarkingsYellow: string;
    path: string;

    grass: string;
    dirt: string;

    sunPosition: { x: number; y: number; z: number };
    sunColor: string;
    sunIntensity: number;
}

const DarkModeColors: Colors = {
    text: "0xeeeeee",
    
    groundColor: "0x161616",
    skyColor: "0x191919",

    buildings: "0x111111",
    vehicles: "0x202020",

    asphalt: "0x181818",
    prefabAsphalt: "0x030303",
    laneMarkings: "0xbababa",
    laneMarkingsYellow: "0xeed700",
    path: "0x00d9ff",
    
    grass: "0x4caf50",
    dirt: "0x8d6e63",

    sunPosition: { x: 20, y: 0, z: 5 },
    sunColor: "0xffffff",
    sunIntensity: 5,
}

const LightModeColors: Colors = {
    text: "0x222222",

    groundColor: "0xffffff",
    skyColor: "0xe1edf4",

    buildings: "0x444444",
    vehicles: "0x555555",

    asphalt: "0x86939c",
    prefabAsphalt: "0x21292f",
    laneMarkings: "0xffffff",
    laneMarkingsYellow: "0xffd700",
    path: "0x00d9ff",

    grass: "0x4caf50",
    dirt: "0x8d6e63",

    sunPosition: { x: 20, y: 10, z: 5 },
    sunColor: "0xffffff",
    sunIntensity: 6,
}

export function getColors(darkMode: boolean): Colors {
    return darkMode ? DarkModeColors : LightModeColors;
}