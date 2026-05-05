import { TeamColor } from "./types";

export const TEAM_COLOR_MAP: Record<TeamColor, {
  bg: string;
  text: string;
  border: string;
  light: string;
  ring: string;
  button: string;
  buttonHover: string;
  badge: string;
}> = {
  blue: {
    bg: "bg-blue-600",
    text: "text-blue-600",
    border: "border-blue-600",
    light: "bg-blue-50",
    ring: "ring-blue-500",
    button: "bg-blue-600 hover:bg-blue-700",
    buttonHover: "hover:bg-blue-700",
    badge: "bg-blue-100 text-blue-800",
  },
  red: {
    bg: "bg-red-600",
    text: "text-red-600",
    border: "border-red-600",
    light: "bg-red-50",
    ring: "ring-red-500",
    button: "bg-red-600 hover:bg-red-700",
    buttonHover: "hover:bg-red-700",
    badge: "bg-red-100 text-red-800",
  },
  green: {
    bg: "bg-green-600",
    text: "text-green-600",
    border: "border-green-600",
    light: "bg-green-50",
    ring: "ring-green-500",
    button: "bg-green-600 hover:bg-green-700",
    buttonHover: "hover:bg-green-700",
    badge: "bg-green-100 text-green-800",
  },
  yellow: {
    bg: "bg-yellow-500",
    text: "text-yellow-600",
    border: "border-yellow-500",
    light: "bg-yellow-50",
    ring: "ring-yellow-400",
    button: "bg-yellow-500 hover:bg-yellow-600",
    buttonHover: "hover:bg-yellow-600",
    badge: "bg-yellow-100 text-yellow-800",
  },
  purple: {
    bg: "bg-purple-600",
    text: "text-purple-600",
    border: "border-purple-600",
    light: "bg-purple-50",
    ring: "ring-purple-500",
    button: "bg-purple-600 hover:bg-purple-700",
    buttonHover: "hover:bg-purple-700",
    badge: "bg-purple-100 text-purple-800",
  },
  orange: {
    bg: "bg-orange-500",
    text: "text-orange-600",
    border: "border-orange-500",
    light: "bg-orange-50",
    ring: "ring-orange-400",
    button: "bg-orange-500 hover:bg-orange-600",
    buttonHover: "hover:bg-orange-600",
    badge: "bg-orange-100 text-orange-800",
  },
};

export function getTeamColors(color: TeamColor) {
  return TEAM_COLOR_MAP[color] || TEAM_COLOR_MAP.blue;
}
