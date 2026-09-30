import { GENRES } from "./genres";

// Book titles for the Sleeve look's cover labels, keyed by genre.
const LABELS = JSON.stringify(Object.fromEntries(Object.values(GENRES).map((g) => [g.key, g.sign.toUpperCase()])));

// Runs inline before first paint: applies the saved look and the open book's colours (see GenreTheme).
export const GENRE_THEME_BOOT = `try{var d=document.documentElement,l=JSON.parse(localStorage.getItem("sl:look"));if(l==="noir"||l==="marquee"||l==="sleeve")d.dataset.look=l;if(location.pathname!=="/"){var g=JSON.parse(localStorage.getItem("sl:genre"))||"jazz",n=${LABELS}[g];if(n){d.dataset.genre=g;d.style.setProperty("--book-label",JSON.stringify(n))}}}catch(e){}`;
