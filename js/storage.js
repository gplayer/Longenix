/* js/storage.js
   Tiny namespaced LocalStorage helper
*/
'use strict';

const Storage = {
  _ns: 'longenix-risk',
  async init(cfg){
    this._ns = ((cfg?.branding?.org || 'Longenix') + '-risk').toLowerCase().replace(/\s+/g,'-');
  },
  key(k){ return `${this._ns}:${k}`; },
  save(k, v){ try{ localStorage.setItem(this.key(k), JSON.stringify(v)); }catch{} },
  load(k, fallback=null){
    try{
      const raw = localStorage.getItem(this.key(k));
      return raw ? JSON.parse(raw) : fallback;
    }catch{
      return fallback;
    }
  }
};

// expose
Object.assign(window, { Storage });
