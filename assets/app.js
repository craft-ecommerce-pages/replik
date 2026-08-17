(function(){
  'use strict';

  /* ── STATE ── */
  let cartItems = []; // [{key, id, nombre, precio, qty, variantes, imagen}]
  let products = [];
  let config = {};
  let activeFilter = 'all';
  let searchQuery = '';

  // Modal state
  let modalProduct = null;
  let modalQty = 1;
  let modalVariants = {};
  let sliderIdx = 0;
  let sliderImages = [];

  /* ── DOM REFS ── */
  const $catalog       = document.getElementById('catalog');
  const $searchInput   = document.getElementById('searchInput');
  const $filterPills   = document.getElementById('filterPills');
  const $cartFab       = document.getElementById('cartFab');
  const $cartBadge     = document.getElementById('cartBadge');
  const $navCartBadge  = document.getElementById('navCartBadge');
  const $cartOverlay   = document.getElementById('cartOverlay');
  const $cartDrawer    = document.getElementById('cartDrawer');
  const $cartClose     = document.getElementById('cartClose');
  const $cartItems     = document.getElementById('cartItems');
  const $cartTotal     = document.getElementById('cartTotal');
  const $cartItemCount = document.getElementById('cartItemCount');
  const $btnCheckout   = document.getElementById('btnCheckout');
  const $cartStep2     = document.getElementById('cartStep2');
  const $cartBack      = document.getElementById('cartBack');
  const $cartTitle     = document.getElementById('cartTitle');
  const $toast         = document.getElementById('toast');
  const $nav           = document.getElementById('mainNav');
  const $modalOverlay  = document.getElementById('modalOverlay');
  const $modalClose    = document.getElementById('modalClose');
  const $sliderTrack   = document.getElementById('sliderTrack');
  const $sliderPrev    = document.getElementById('sliderPrev');
  const $sliderNext    = document.getElementById('sliderNext');
  const $sliderDots    = document.getElementById('sliderDots');
  const $modalDetail   = document.getElementById('modalDetail');

  /* ── HELPERS ── */
  function normalize(s){
    return (s||'').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  }

  function getImages(p){
    if(Array.isArray(p.imagenes) && p.imagenes.length) return p.imagenes;
    if(p.imagen) return [p.imagen];
    return [];
  }

  function cartKey(id, variantes){
    if(!variantes || !Object.keys(variantes).length) return String(id);
    return id + ':' + Object.entries(variantes).sort().map(([k,v])=>k+'='+v).join(',');
  }

  function variantLabel(variantes){
    if(!variantes || !Object.keys(variantes).length) return '';
    return Object.values(variantes).join(' · ');
  }

  let toastTimer;
  function showToast(msg){
    $toast.textContent = msg;
    $toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $toast.classList.remove('show'), 2200);
  }

  function formatPrice(price){
    const cur = config.currency || '$';
    return `${cur}${price}`;
  }

  /* ── SCROLL NAV ── */
  window.addEventListener('scroll', () => {
    $nav.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });

  /* ── CART LOGIC ── */
  function cartFind(key){ return cartItems.find(i => i.key === key); }

  function cartAdd(id, variantes, qty){
    const p = products.find(x => String(x.id) === String(id));
    if(!p) return;
    const key = cartKey(id, variantes);
    const existing = cartFind(key);
    if(existing){ existing.qty += qty; }
    else{
      cartItems.push({
        key, id, nombre: p.nombre,
        precio: p.precio,
        qty,
        variantes: variantes || {},
        imagen: getImages(p)[0] || ''
      });
    }
    saveCart(); updateCartUI(); updateCardButtons();
    showToast(`${p.nombre} agregado`);
  }

  function cartRemoveOne(key){
    const item = cartFind(key);
    if(!item) return;
    item.qty--;
    if(item.qty <= 0) cartItems = cartItems.filter(i => i.key !== key);
    saveCart(); updateCartUI(); updateCardButtons();
  }

  function cartDelete(key){
    cartItems = cartItems.filter(i => i.key !== key);
    saveCart(); updateCartUI(); updateCardButtons();
  }

  function saveCart(){
    try{ localStorage.setItem('replik_cart2', JSON.stringify(cartItems)); }catch(e){}
  }

  function loadCart(){
    try{
      const s = JSON.parse(localStorage.getItem('replik_cart2') || '[]');
      if(Array.isArray(s)) cartItems = s;
    }catch(e){}
  }

  function cartTotalQty(){ return cartItems.reduce((s,i) => s+i.qty, 0); }
  function cartTotalPrice(){ return cartItems.reduce((s,i) => s+(i.precio*i.qty), 0); }

  /* ── RENDER CATALOG ── */
  function renderCatalog(){
    const filtered = products.filter(p => {
      const matchCat = activeFilter === 'all' || (p.categorias||[]).includes(activeFilter);
      const matchSearch = !searchQuery
        || normalize(p.nombre).includes(searchQuery)
        || normalize(p.descripcion||'').includes(searchQuery);
      return matchCat && matchSearch;
    });

    const $count = document.getElementById('filterCount');
    if($count) $count.textContent = `${filtered.length} fragancia${filtered.length !== 1 ? 's' : ''}`;

    const groups = {};
    filtered.forEach(p => {
      const primaryCat = (p.categorias||[])[0]||'';
      if(!groups[primaryCat]) groups[primaryCat] = [];
      groups[primaryCat].push(p);
    });

    $catalog.innerHTML = '';
    const catOrder = ['hombre','mujer'];
    const catLabels = config.categories || { hombre: 'Para Él', mujer: 'Para Ella' };

    catOrder.forEach(cat => {
      if(!groups[cat] || groups[cat].length === 0) return;

      const header = document.createElement('h2');
      header.className = 'cat-header';
      header.textContent = catLabels[cat] || cat;
      $catalog.appendChild(header);

      const grid = document.createElement('div');
      grid.className = 'grid';

      groups[cat].forEach((p, i) => {
        const imgs = getImages(p);
        const hasVariants = Array.isArray(p.variantes) && p.variantes.length > 0;
        const inCartQty = cartItems.filter(ci => String(ci.id) === String(p.id)).reduce((s,ci) => s+ci.qty, 0);

        const card = document.createElement('div');
        card.className = 'card';
        card.style.animationDelay = `${i * 0.06}s`;
        card.dataset.id = p.id;

        card.innerHTML = `
          <div class="card-img" data-open="${p.id}">
            <img src="${imgs[0] || ''}" alt="${p.nombre}" loading="lazy" onerror="this.style.opacity=0"/>
            <div class="card-img-overlay">
              <button class="btn-add-hover" data-open="${p.id}">
                ${hasVariants ? 'Elegir opciones' : 'Ver producto'}
              </button>
            </div>
          </div>
          <div class="card-body">
            <div class="card-cat">${catLabels[(p.categorias||[])[0]] || (p.categorias||[])[0] || ''}</div>
            <div class="card-name">${p.nombre}</div>
            ${p.descripcion ? `<div class="card-desc">${p.descripcion}</div>` : ''}
            <div class="card-footer">
              <div class="card-price">${formatPrice(p.precio)}</div>
              <div class="card-actions">
                ${(!hasVariants && inCartQty > 0) ? `
                  <div class="qty-control">
                    <button data-action="dec" data-id="${p.id}" data-key="${cartKey(p.id,{})}">−</button>
                    <span class="qty-val">${inCartQty}</span>
                    <button data-action="inc" data-id="${p.id}">+</button>
                  </div>
                ` : `
                  <button class="btn-add${inCartQty > 0 ? ' in-cart' : ''}" ${hasVariants ? `data-open="${p.id}"` : `data-add="${p.id}"`}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
                    ${hasVariants ? 'Elegir' : 'Agregar'}
                  </button>
                `}
              </div>
            </div>
          </div>
        `;

        grid.appendChild(card);
      });

      $catalog.appendChild(grid);
    });

    if(filtered.length === 0){
      $catalog.innerHTML = '<div class="empty-state"><p>No se encontraron fragancias</p></div>';
    }
  }

  function updateCardButtons(){
    document.querySelectorAll('.card').forEach(card => {
      const id = card.dataset.id;
      const p = products.find(x => String(x.id) === String(id));
      if(!p) return;
      const hasVariants = Array.isArray(p.variantes) && p.variantes.length > 0;
      const inCartQty = cartItems.filter(ci => String(ci.id) === String(id)).reduce((s,ci) => s+ci.qty, 0);
      const actionsEl = card.querySelector('.card-actions');
      if(!actionsEl) return;

      if(!hasVariants && inCartQty > 0){
        actionsEl.innerHTML = `
          <div class="qty-control">
            <button data-action="dec" data-id="${id}" data-key="${cartKey(id,{})}">−</button>
            <span class="qty-val">${inCartQty}</span>
            <button data-action="inc" data-id="${id}">+</button>
          </div>
        `;
      } else {
        actionsEl.innerHTML = `
          <button class="btn-add${inCartQty > 0 ? ' in-cart' : ''}" ${hasVariants ? `data-open="${id}"` : `data-add="${id}"`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
            ${hasVariants ? 'Elegir' : 'Agregar'}
          </button>
        `;
      }
    });
  }

  /* ── PRODUCT MODAL ── */
  function openModal(id){
    const p = products.find(x => String(x.id) === String(id));
    if(!p) return;
    modalProduct = p;
    modalQty = 1;
    modalVariants = {};
    sliderImages = getImages(p);
    sliderIdx = 0;

    $sliderTrack.innerHTML = sliderImages.map(src =>
      `<div class="slider-slide"><img src="${src}" alt="${p.nombre}" loading="lazy"/></div>`
    ).join('');
    $sliderTrack.style.transform = 'translateX(0)';

    $sliderDots.innerHTML = sliderImages.map((_,i) =>
      `<button class="slider-dot${i===0?' active':''}" data-idx="${i}"></button>`
    ).join('');

    $sliderPrev.hidden = sliderImages.length <= 1;
    $sliderNext.hidden = sliderImages.length <= 1;

    renderModalDetail();

    $modalOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function renderModalDetail(){
    const p = modalProduct;
    const hasVariants = Array.isArray(p.variantes) && p.variantes.length > 0;
    const catLabels = config.categories || { hombre: 'Para Él', mujer: 'Para Ella' };

    let variantHTML = '';
    if(hasVariants){
      variantHTML = p.variantes.map(group => `
        <div class="variant-group">
          <div class="variant-label">${group.name}</div>
          <div class="variant-options">
            ${group.options.map(opt => { const k=(typeof opt==='object'&&opt!==null)?(opt.label||''):opt; return `
              <button class="variant-option${modalVariants[group.name]===k?' selected':''}"
                data-group="${group.name}" data-opt="${k}">${k}</button>
            `;}).join('')}
          </div>
        </div>
      `).join('');
    }

    const allSelected = !hasVariants || p.variantes.every(g => modalVariants[g.name]);

    $modalDetail.innerHTML = `
      <div class="modal-name">${p.nombre}</div>
      <div class="modal-cat">${catLabels[(p.categorias||[])[0]] || (p.categorias||[])[0] || ''}</div>
      <div class="modal-price">${formatPrice(p.precio)}</div>
      ${p.descripcion ? `<div class="modal-desc">${p.descripcion}</div>` : ''}
      ${variantHTML}
      ${hasVariants && !allSelected ? '<p class="modal-variant-hint">Selecciona todas las opciones</p>' : ''}
      <div class="modal-actions">
        <div class="modal-qty">
          <button id="mqDec">−</button>
          <span class="qty-val" id="mqVal">${modalQty}</span>
          <button id="mqInc">+</button>
        </div>
        <button class="btn-modal-add" id="btnModalAdd" ${allSelected ? '' : 'disabled'}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
          Agregar al carrito
        </button>
      </div>
    `;

    document.getElementById('mqDec').addEventListener('click', () => {
      if(modalQty > 1){ modalQty--; document.getElementById('mqVal').textContent = modalQty; }
    });
    document.getElementById('mqInc').addEventListener('click', () => {
      modalQty++;
      document.getElementById('mqVal').textContent = modalQty;
    });
    document.getElementById('btnModalAdd').addEventListener('click', () => {
      cartAdd(modalProduct.id, modalVariants, modalQty);
      closeModal();
    });

    $modalDetail.querySelectorAll('.variant-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const group=btn.dataset.group, opt=btn.dataset.opt;
        modalVariants[group] = opt;
        const _g=(modalProduct.variantes||[]).find(g=>g.name===group);
        const _o=_g&&(_g.options||[]).find(o=>((typeof o==='object'&&o!==null)?(o.label||''):o)===opt);
        if(_o&&_o.image){const _i=sliderImages.indexOf(_o.image);if(_i>=0)slideTo(_i);}
        renderModalDetail();
      });
    });
  }

  function closeModal(){
    $modalOverlay.classList.remove('open');
    document.body.style.overflow = '';
    modalProduct = null;
  }

  /* ── SLIDER ── */
  function slideTo(idx){
    sliderIdx = Math.max(0, Math.min(idx, sliderImages.length - 1));
    $sliderTrack.style.transform = `translateX(-${sliderIdx * 100}%)`;
    $sliderDots.querySelectorAll('.slider-dot').forEach((d,i) => d.classList.toggle('active', i === sliderIdx));
  }

  $sliderPrev.addEventListener('click', e => { e.stopPropagation(); slideTo(sliderIdx - 1); });
  $sliderNext.addEventListener('click', e => { e.stopPropagation(); slideTo(sliderIdx + 1); });
  $sliderDots.addEventListener('click', e => {
    const dot = e.target.closest('.slider-dot');
    if(dot) slideTo(Number(dot.dataset.idx));
  });

  let touchStartX = 0;
  document.getElementById('sliderWrap').addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].clientX;
  }, { passive: true });
  document.getElementById('sliderWrap').addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if(Math.abs(dx) > 40) slideTo(dx < 0 ? sliderIdx + 1 : sliderIdx - 1);
  });

  /* ── CART DRAWER UI ── */
  function updateCartUI(){
    const qty = cartTotalQty();
    const total = cartTotalPrice();

    $cartBadge.textContent = qty;
    $cartBadge.classList.toggle('show', qty > 0);
    $navCartBadge.textContent = qty;
    $navCartBadge.classList.toggle('show', qty > 0);

    $cartTotal.textContent = formatPrice(total);
    $cartItemCount.textContent = `${qty} producto${qty !== 1 ? 's' : ''}`;
    $btnCheckout.disabled = qty === 0;

    if(!cartItems.length){
      $cartItems.innerHTML = `
        <div class="cart-empty">
          <div class="cart-empty-icon">✦</div>
          <p>Tu carrito está vacío</p>
        </div>
      `;
      return;
    }

    $cartItems.innerHTML = '';
    cartItems.forEach(item => {
      const vLabel = variantLabel(item.variantes);
      const div = document.createElement('div');
      div.className = 'cart-item';
      div.innerHTML = `
        <img src="${item.imagen || ''}" alt="${item.nombre}" onerror="this.style.opacity=0"/>
        <div class="cart-item-info">
          <div class="cart-item-name">${item.nombre}</div>
          ${vLabel ? `<div class="cart-item-detail">${vLabel}</div>` : ''}
          <div class="cart-item-detail">${item.qty} × ${formatPrice(item.precio)} = ${formatPrice(item.qty * item.precio)}</div>
        </div>
        <button class="cart-item-remove" data-key="${item.key}" title="Quitar">✕</button>
      `;
      $cartItems.appendChild(div);
    });
  }

  /* ── CART OPEN/CLOSE ── */
  function openCart(){
    $cartOverlay.classList.add('open');
    $cartDrawer.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeCart(){
    $cartOverlay.classList.remove('open');
    $cartDrawer.classList.remove('open');
    document.body.style.overflow = '';
    goToStep1();
  }

  function goToStep1(){
    $cartStep2.style.display = 'none';
    $cartItems.closest('.cart-items').style.display = '';
    $cartDrawer.querySelector('.cart-footer').style.display = '';
    $cartBack.style.display = 'none';
    $cartTitle.textContent = 'Mi carrito';
  }

  function goToStep2(){
    $cartStep2.style.display = 'flex';
    $cartItems.closest('.cart-items').style.display = 'none';
    $cartDrawer.querySelector('.cart-footer').style.display = 'none';
    $cartBack.style.display = '';
    $cartTitle.textContent = 'Datos de entrega';
  }

  /* ── WHATSAPP CHECKOUT ── */
  function checkout(){
    const num = (config.whatsapp_number || '').replace(/\D/g, '');
    if(!num){ showToast('WhatsApp no configurado'); return; }

    const name    = document.getElementById('fieldName').value.trim();
    const phone   = document.getElementById('fieldPhone').value.trim();
    const mode    = document.querySelector('.dtog-btn.active')?.dataset.mode || 'delivery';
    const address = mode === 'delivery' ? document.getElementById('fieldAddress').value.trim() : '';

    if(!name || !phone){ showToast('Completa tu nombre y teléfono'); return; }
    if(mode === 'delivery' && !address){ showToast('Ingresa tu dirección de entrega'); return; }

    const total = cartTotalPrice();
    const store = config.store_name || 'RepliK';
    const cur   = config.currency || '$';

    // Notifica al dueño — fire-and-forget
    if(config.catalog_notify_url && config.catalog_notify_token){
      fetch(config.catalog_notify_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: config.catalog_notify_token,
          store_name: store,
          items: cartItems.map(i => ({ nombre: i.nombre, qty: i.qty, precio: i.precio, variant: variantLabel(i.variantes) || undefined })),
          total, currency: cur,
          client_name: name, client_phone: phone,
          delivery_mode: mode, address: address || undefined,
          store_url: location.href
        })
      }).catch(() => {});
    }

    let msg = `${config.whatsapp_message || '¡Hola! Quiero hacer un pedido:'}\n\n*PEDIDO — ${store}*\n━━━━━━━━━━━━━━━━━\n`;
    cartItems.forEach(item => {
      const vLabel = variantLabel(item.variantes);
      msg += `▸ ${item.nombre}${vLabel ? ' (' + vLabel + ')' : ''}\n  ${item.qty} × ${formatPrice(item.precio)} = ${formatPrice(item.qty * item.precio)}\n`;
    });
    msg += `━━━━━━━━━━━━━━━━━\n*TOTAL: ${cur}${total.toFixed(2)}*\n\n`;
    msg += `*ENTREGA:* ${mode === 'delivery' ? 'Domicilio' : 'Retiro en local'}\n`;
    msg += `*Cliente:* ${name}\n*Teléfono:* ${phone}\n`;
    if(address) msg += `*Dirección:* ${address}\n`;
    msg += `\n${location.href}`;

    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank');

    if(window.dataLayer){
      window.dataLayer.push({
        event: 'whatsapp_checkout',
        ecommerce: { value: total, currency: 'USD', items: cartItems.map(i => ({ item_id: i.id, item_name: i.nombre, quantity: i.qty, price: i.precio })) }
      });
    }
  }

  /* ── EVENTS ── */
  document.addEventListener('click', e => {
    // Direct add (no-variant products)
    const addTrigger = e.target.closest('[data-add]');
    if(addTrigger && !e.target.closest('[data-action]')){
      cartAdd(addTrigger.dataset.add, {}, 1);
      return;
    }

    // Open modal
    const openTrigger = e.target.closest('[data-open]');
    if(openTrigger && !e.target.closest('[data-action]')){
      openModal(openTrigger.dataset.open);
      return;
    }

    // Card qty controls
    const btn = e.target.closest('[data-action]');
    if(btn){
      e.stopPropagation();
      const { action, id, key } = btn.dataset;
      if(action === 'inc') cartAdd(id, {}, 1);
      if(action === 'dec' && key) cartRemoveOne(key);
      return;
    }

    // Cart remove
    const removeBtn = e.target.closest('.cart-item-remove');
    if(removeBtn){ cartDelete(removeBtn.dataset.key); return; }
  });

  $filterPills.addEventListener('click', e => {
    const pill = e.target.closest('.pill');
    if(!pill) return;
    $filterPills.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    activeFilter = pill.dataset.cat;
    renderCatalog();
  });

  $searchInput.addEventListener('input', () => {
    searchQuery = normalize($searchInput.value);
    renderCatalog();
  });

  $cartFab.addEventListener('click', openCart);
  document.getElementById('navCartBtn').addEventListener('click', openCart);
  $cartOverlay.addEventListener('click', closeCart);
  $cartClose.addEventListener('click', closeCart);
  $btnCheckout.addEventListener('click', goToStep2);
  $cartBack.addEventListener('click', goToStep1);
  document.getElementById('btnConfirm').addEventListener('click', checkout);
  document.getElementById('deliveryToggle').addEventListener('click', e => {
    const btn = e.target.closest('.dtog-btn');
    if(!btn) return;
    document.querySelectorAll('.dtog-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('fieldAddressWrap').style.display = btn.dataset.mode === 'delivery' ? '' : 'none';
  });

  $modalOverlay.addEventListener('click', e => { if(e.target === $modalOverlay) closeModal(); });
  $modalClose.addEventListener('click', closeModal);

  document.addEventListener('keydown', e => {
    if(e.key === 'Escape'){ closeModal(); closeCart(); }
    if(e.key === 'ArrowLeft' && $modalOverlay.classList.contains('open')) slideTo(sliderIdx - 1);
    if(e.key === 'ArrowRight' && $modalOverlay.classList.contains('open')) slideTo(sliderIdx + 1);
  });

  /* ── INIT ── */
  async function init(){
    try{
      const r = await fetch('config.json', { cache: 'no-store' });
      if(r.ok) config = await r.json();
    }catch(e){}

    if(config.store_name){
      document.title = config.site_title || config.store_name;
    }

    const res = await fetch('productos.json', { cache: 'no-store' });
    products = await res.json();

    loadCart();
    cartItems = cartItems.filter(ci => products.find(p => String(p.id) === String(ci.id)));

    renderCatalog();
    updateCartUI();
  }

  init().catch(err => {
    console.error(err);
    $catalog.innerHTML = '<div class="empty-state"><p>Error cargando el catalogo</p></div>';
  });

})();
