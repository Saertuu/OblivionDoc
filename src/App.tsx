import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUpRight, Menu, Moon, Sun, X } from 'lucide-react';

function Brand({ compact = false }: { compact?: boolean }) {
  return <a className="brand" href="#top" aria-label="OblivionDoc — в начало">
    <svg className="brand-mark" viewBox="0 0 40 40" aria-hidden="true"><ellipse cx="20" cy="20" rx="10" ry="17" transform="rotate(35 20 20)" /><circle cx="32" cy="8" r="4" /></svg>
    {!compact && <span>Oblivion<span className="brand-light">Doc</span></span>}
  </a>;
}

export function App() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'dark');
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('obliviondoc-theme', theme); } catch { /* Storage is optional. */ }
  }, [theme]);
  useEffect(() => {
    function onKey(event: KeyboardEvent) { if (event.key === 'Escape') setMenuOpen(false); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return <>
    <a className="skip-link" href="#main">Перейти к содержимому</a>
    <div className="site" id="top">
      <header className="header shell">
        <Brand />
        <nav className={menuOpen ? 'nav is-open' : 'nav'} aria-label="Основная навигация" id="navigation">
          <a href="#concept" onClick={() => setMenuOpen(false)}>Концепция <ArrowUpRight size={13} /></a>
          <a href="#details" onClick={() => setMenuOpen(false)}>Детали <ArrowUpRight size={13} /></a>
        </nav>
        <div className="header-actions">
          <button className="icon-button theme-toggle" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}>
            {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <button className="icon-button menu-toggle" type="button" aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'} aria-expanded={menuOpen} aria-controls="navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
          <span className="header-caption">Новая перспектива <ArrowUpRight size={17} /></span>
        </div>
      </header>

      <main id="main">
        <section className="hero shell" aria-labelledby="hero-title">
          <div className="hero-topline"><span className="eyebrow"><span className="status-dot" /> Визуальная концепция</span><span className="edition">01 — OB / DOC</span></div>
          <div className="hero-copy">
            <p className="hero-kicker">Знакомое имя. Новое ощущение.</p>
            <h1 id="hero-title">Oblivion<span>Doc<span className="title-dot">.</span></span></h1>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="art-grid" />
            <div className="orb-shadow" />
            <div className="orb"><div className="orb-inner" /><div className="orb-shine" /></div>
            <svg className="orb-orbit" viewBox="0 0 700 640"><ellipse cx="350" cy="320" rx="310" ry="107" transform="rotate(-37 350 320)" /><circle cx="595" cy="139" r="5" /></svg>
            <span className="art-coordinate coordinate-top">OB·01 / 55.75°</span>
            <span className="art-coordinate coordinate-bottom">FORM FOLLOWS FEELING</span>
          </div>
          <div className="hero-bottom"><p>Чистая форма.<br /><span>Внимание к каждой детали.</span></p><a className="round-link" href="#concept"><span>Исследовать<br />концепцию</span><span className="round-arrow"><ArrowDown size={20} /></span></a><span className="scroll-label">SCROLL TO EXPLORE</span></div>
        </section>

        <section className="concept-section" id="concept" aria-labelledby="concept-title">
          <div className="shell concept-layout">
            <p className="section-label"><span>01 / КОНЦЕПЦИЯ</span><span className="small-cross">+</span></p>
            <div><h2 id="concept-title">Меньше шума.<br /><span>Больше характера.</span></h2><p className="section-description">Спокойная палитра, выразительная типографика и движение, которое ощущается естественно. Первый взгляд на новый визуальный язык OblivionDoc.</p></div>
          </div>
          <div className="shell design-grid" id="details">
            <article className="design-card palette-card"><div className="card-heading"><span>01 — ЦВЕТ</span><ArrowUpRight size={18} /></div><div className="swatches" aria-label="Палитра: глубокий хвойный, тёплый фарфор, терракота"><span /><span /><span /></div><h3>Тихая выразительность</h3><p>Глубокий хвойный, тёплый фарфор и точечный терракотовый акцент.</p></article>
            <article className="design-card type-card"><div className="card-heading"><span>02 — ТИПОГРАФИКА</span><ArrowUpRight size={18} /></div><div className="type-sample" aria-hidden="true">Aa<span>Бб</span><small>Manrope / 400 — 700</small></div><h3>Ясность в каждом слове</h3><p>Крупные заголовки, свободный ритм и комфортное чтение на любом экране.</p></article>
            <article className="design-card motion-card"><div className="card-heading"><span>03 — ДВИЖЕНИЕ</span><ArrowUpRight size={18} /></div><div className="motion-sample" aria-hidden="true"><span /><span /><span /><span /><span /></div><h3>Естественный ритм</h3><p>Мягкие переходы и деликатные анимации с учётом настроек доступности.</p></article>
          </div>
        </section>
      </main>
      <footer className="footer shell"><Brand /><p>Визуальная концепция · {new Date().getFullYear()}</p><a href="#top">Наверх <ArrowUpRight size={15} /></a></footer>
    </div>
  </>;
}
