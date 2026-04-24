(function(){
  'use strict';

  /* ── STATE ── */
  const cart = {};
  let products = [];
  let config = {};
  let activeFilter = 'all';
  let searchQuery = '';

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
  const $toast         = document.getElementById('toast');
  const $nav           = document.getElementById('mainNav');

  /* ── HELPERS ── */
  function normalize(s){
    return (s||'').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
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
  function cartAdd(id){
    cart[id] = (cart[id] || 0) + 1;
    saveCart();
    updateCartUI();
    updateCardButtons();
    const p = products.find(x => x.id === id);
    showToast(`${p ? p.nombre : 'Producto'} agregado`);
  }

  function cartRemove(id){
    if(cart[id]) cart[id]--;
    if(cart[id] <= 0) delete cart[id];
    saveCart();
    updateCartUI();
    updateCardButtons();
  }

  function cartSet(id, qty){
    if(qty <= 0) delete cart[id];
    else cart[id] = qty;
    saveCart();
    updateCartUI();
    updateCardButtons();
  }

  function saveCart(){
    try{ localStorage.setItem('replik_cart', JSON.stringify(cart)); }catch(e){}
  }

  function loadCart(){
    try{
      const saved = JSON.parse(localStorage.getItem('replik_cart') || '{}');
      Object.assign(cart, saved);
    }catch(e){}
  }

  function getCartTotals(){
    let items = 0, total = 0;
    for(const [id, qty] of Object.entries(cart)){
      const p = products.find(x => x.id === id);
      if(p){ items += qty; total += qty * p.precio; }
    }
    return { items, total };
  }

  /* ── RENDER CATALOG ── */
  function renderCatalog(){
    const filtered = products.filter(p => {
      const matchCat = activeFilter === 'all' || p.categoria === activeFilter;
      const matchSearch = !searchQuery
        || normalize(p.nombre).includes(searchQuery)
        || normalize(p.descripcion||'').includes(searchQuery);
      return matchCat && matchSearch;
    });

    // Update count
    const $count = document.getElementById('filterCount');
    if($count) $count.textContent = `${filtered.length} fragancia${filtered.length !== 1 ? 's' : ''}`;

    // Group by category
    const groups = {};
    filtered.forEach(p => {
      if(!groups[p.categoria]) groups[p.categoria] = [];
      groups[p.categoria].push(p);
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
        const card = document.createElement('div');
        card.className = 'card';
        card.style.animationDelay = `${i * 0.06}s`;
        card.dataset.id = p.id;

        const inCart = cart[p.id] || 0;

        card.innerHTML = `
          <div class="card-img">
            <img src="${p.imagen}" alt="${p.nombre}" loading="lazy" onerror="this.style.opacity=0"/>
            <div class="card-img-overlay">
              <button class="btn-add-hover" data-action="add" data-id="${p.id}">
                Agregar al carrito
              </button>
            </div>
          </div>
          <div class="card-body">
            <div class="card-cat">${catLabels[p.categoria] || p.categoria}</div>
            <div class="card-name">${p.nombre}</div>
            ${p.descripcion ? `<div class="card-desc">${p.descripcion}</div>` : ''}
            <div class="card-footer">
              <div class="card-price">${formatPrice(p.precio)}</div>
              <div class="card-actions">
                ${inCart > 0 ? `
                  <div class="qty-control">
                    <button data-action="dec" data-id="${p.id}">−</button>
                    <span class="qty-val">${inCart}</span>
                    <button data-action="inc" data-id="${p.id}">+</button>
                  </div>
                ` : `
                  <button class="btn-add" data-id="${p.id}" data-action="add">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
                    Agregar
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
      const inCart = cart[id] || 0;
      const actionsEl = card.querySelector('.card-actions');
      if(!actionsEl) return;

      if(inCart > 0){
        actionsEl.innerHTML = `
          <div class="qty-control">
            <button data-action="dec" data-id="${id}">−</button>
            <span class="qty-val">${inCart}</span>
            <button data-action="inc" data-id="${id}">+</button>
          </div>
        `;
      } else {
        actionsEl.innerHTML = `
          <button class="btn-add" data-id="${id}" data-action="add">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Agregar
          </button>
        `;
      }
    });
  }

  /* ── CART DRAWER ── */
  function updateCartUI(){
    const { items, total } = getCartTotals();
    const catLabels = config.categories || { hombre: 'Para Él', mujer: 'Para Ella' };

    // Badges
    $cartBadge.textContent = items;
    $cartBadge.classList.toggle('show', items > 0);
    $navCartBadge.textContent = items;
    $navCartBadge.classList.toggle('show', items > 0);

    // Totals
    $cartTotal.textContent = formatPrice(total);
    $cartItemCount.textContent = `${items} producto${items !== 1 ? 's' : ''}`;
    $btnCheckout.disabled = items === 0;

    // Items list
    const ids = Object.keys(cart);
    if(ids.length === 0){
      $cartItems.innerHTML = `
        <div class="cart-empty">
          <div class="cart-empty-icon">✦</div>
          <p>Tu carrito está vacío</p>
        </div>
      `;
      return;
    }

    $cartItems.innerHTML = '';
    ids.forEach(id => {
      const p = products.find(x => x.id === id);
      if(!p) return;
      const qty = cart[id];
      const div = document.createElement('div');
      div.className = 'cart-item';
      div.innerHTML = `
        <img src="${p.imagen}" alt="${p.nombre}" onerror="this.style.opacity=0"/>
        <div class="cart-item-info">
          <div class="cart-item-name">${p.nombre}</div>
          <div class="cart-item-detail">${catLabels[p.categoria] || p.categoria} · ${qty} × ${formatPrice(p.precio)}</div>
          <div class="cart-item-price">${formatPrice(qty * p.precio)}</div>
        </div>
        <button class="cart-item-remove" data-id="${id}" title="Quitar">✕</button>
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
  }

  /* ── WHATSAPP CHECKOUT ── */
  function checkout(){
    const num = (config.whatsapp_number || '').replace(/\D/g, '');
    if(!num){ alert('Numero de WhatsApp no configurado'); return; }

    const { total } = getCartTotals();
    const catLabels = config.categories || { hombre: 'Para Él', mujer: 'Para Ella' };

    let msg = `${config.whatsapp_message || 'Hola! Quiero hacer un pedido:'}\n\n`;
    msg += `*PEDIDO REPLIK*\n`;
    msg += `━━━━━━━━━━━━━━━━━\n`;

    Object.entries(cart).forEach(([id, qty]) => {
      const p = products.find(x => x.id === id);
      if(!p) return;
      msg += `▸ ${p.nombre}\n`;
      msg += `  ${qty} × ${formatPrice(p.precio)} = ${formatPrice(qty * p.precio)}\n`;
    });

    msg += `━━━━━━━━━━━━━━━━━\n`;
    msg += `*TOTAL: ${formatPrice(total)}*\n\n`;
    msg += `Catalogo: ${location.href}`;

    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank');

    if(window.dataLayer){
      window.dataLayer.push({
        event: 'whatsapp_checkout',
        ecommerce: {
          value: total,
          currency: 'USD',
          items: Object.entries(cart).map(([id, qty]) => {
            const p = products.find(x => x.id === id);
            return { item_id: id, item_name: p?.nombre, quantity: qty, price: p?.precio };
          })
        }
      });
    }
  }

  /* ── EVENTS ── */
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if(btn){
      e.stopPropagation();
      const { action, id } = btn.dataset;
      if(action === 'add' || action === 'inc') cartAdd(id);
      if(action === 'dec') cartRemove(id);
      return;
    }

    const removeBtn = e.target.closest('.cart-item-remove');
    if(removeBtn){
      cartSet(removeBtn.dataset.id, 0);
      return;
    }
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
  $btnCheckout.addEventListener('click', checkout);

  document.addEventListener('keydown', e => {
    if(e.key === 'Escape') closeCart();
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
    Object.keys(cart).forEach(id => {
      if(!products.find(p => p.id === id)) delete cart[id];
    });

    renderCatalog();
    updateCartUI();
  }

  init().catch(err => {
    console.error(err);
    $catalog.innerHTML = '<div class="empty-state"><p>Error cargando el catalogo</p></div>';
  });

})();
