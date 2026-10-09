/** Applies the saved theme before paint (no flash). Values: "system" | "light" | "dark". */
export function ThemeScript() {
  const js = `try{var t=localStorage.getItem('fo-theme');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t}}catch(e){}`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
