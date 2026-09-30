import { GENRES } from "./genres";

// Book titles for the page covers' labels, keyed by genre.
const LABELS = JSON.stringify(Object.fromEntries(Object.values(GENRES).map((g) => [g.key, g.sign.toUpperCase()])));

// Runs inline before first paint: applies the open book's colours (see GenreTheme).
export const GENRE_THEME_BOOT = `try{var d=document.documentElement;if(location.pathname!=="/"){var g=JSON.parse(localStorage.getItem("sl:genre"))||"jazz",n=${LABELS}[g];if(n){d.dataset.genre=g;d.style.setProperty("--book-label",JSON.stringify(n))}}}catch(e){}`;
