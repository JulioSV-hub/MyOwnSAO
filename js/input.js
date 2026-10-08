// Teclado + mouse com Pointer Lock (mira em primeira pessoa).
export class Input {
  constructor(el) {
    this.el = el;
    this.keys = new Set();
    this.down = new Set();
    this.mouse = { dx: 0, dy: 0, buttons: new Set(), clicked: new Set() };
    this.locked = false;
    this.forceLocked = false; // usado em testes automatizados
    this.onLockChange = null;

    addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (['Tab', 'Space', 'AltLeft'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.down.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.mouse.buttons.clear(); });
    document.addEventListener('mousemove', (e) => {
      if (this.isLocked) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; }
    });
    el.addEventListener('mousedown', (e) => {
      if (!this.isLocked) return;
      this.mouse.buttons.add(e.button);
      this.mouse.clicked.add(e.button);
    });
    addEventListener('mouseup', (e) => this.mouse.buttons.delete(e.button));
    addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === el;
      if (!this.locked) { this.mouse.buttons.clear(); this.keys.clear(); }
      this.onLockChange?.(this.locked);
    });
  }

  get isLocked() { return this.locked || this.forceLocked; }

  lock() {
    if (this.forceLocked) return;
    try {
      const p = this.el.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch { /* o navegador pode recusar sem um clique */ }
  }

  unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  pressed(code) { return this.down.has(code); }
  held(code) { return this.keys.has(code); }

  endFrame() {
    this.down.clear();
    this.mouse.clicked.clear();
    this.mouse.dx = 0;
    this.mouse.dy = 0;
  }
}
