const Storage = {
  _ns: 'longenix-risk',
  async init(cfg){ this._ns = (cfg?.branding?.org || 'longenix') + '-risk'; },
  key(k){ return this._ns + ':' + k; },
  save(k, v){ localStorage.setItem(this.key(k), JSON.stringify(v)); },
  load(k, fallback=null){
    const raw = localStorage.getItem(this.key(k)); if(!raw) return fallback;
    try{ return JSON.parse(raw); }catch{ return fallback; }
  }
};
