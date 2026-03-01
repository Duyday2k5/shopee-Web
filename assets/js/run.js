const AppState = {
    currentUser: null,
    products: [],
    cart: [],
    purchases: [],
    currentPage: 1,
    itemsPerPage: 15,
    filteredProducts: [],
    currentCategory: 'all',
    currentRatingFilter: 0,

    init() {
        this.loadFromLocalStorage();
        this.loadProducts();
    },

    loadFromLocalStorage() {
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
        }

        const savedCart = localStorage.getItem('cart');
        if (savedCart) {
            this.cart = JSON.parse(savedCart);
        }

        const savedPurchases = localStorage.getItem('purchases');
        if (savedPurchases) {
            this.purchases = JSON.parse(savedPurchases);
        }
    },

    saveToLocalStorage() {
        if (this.currentUser) {
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
        }
        localStorage.setItem('cart', JSON.stringify(this.cart));
        localStorage.setItem('purchases', JSON.stringify(this.purchases));
    },

    loadProducts() {
        fetch('./data.json')
            .then(response => response.json())
            .then(data => {
                this.products = data.products;
                this.filteredProducts = [...this.products];
                UI.renderProducts(this.getProductsForCurrentPage());
                UI.renderFlashSale(this.products);
                UI.updatePagination();
                UI.updateUserUI();
                UI.updateCartCount();
            })
            .catch(error => console.error('Error loading products:', error));
    },

    getProductsForCurrentPage() {
        const start = (this.currentPage - 1) * this.itemsPerPage;
        return this.filteredProducts.slice(start, start + this.itemsPerPage);
    },

    getTotalPages() {
        return Math.ceil(this.filteredProducts.length / this.itemsPerPage);
    },

    setCurrentPage(page) {
        this.currentPage = Math.max(1, Math.min(page, this.getTotalPages()));
    },

    filterProducts(searchTerm = '') {
        // Trigger the unified advanced filter pipeline
        if (typeof window.runAdvancedFilters === 'function') {
            window.runAdvancedFilters();
        }
    },

    setCategory(categoryName) {
        this.currentCategory = categoryName;
        // visual update
        document.querySelectorAll('.category__item').forEach(el => el.classList.remove('category__item--active'));
        const links = document.querySelectorAll('.category__item-link');
        links.forEach(l => {
            if (l.textContent.trim().toLowerCase() === categoryName.toLowerCase() ||
                (categoryName === 'all' && l.textContent.trim().includes('Tất Cả'))) {
                l.parentElement.classList.add('category__item--active');
            }
        });

        // Reset advanced filters UI
        const filterCheckboxes = document.querySelectorAll('.advanced-filters input[type="checkbox"]');
        if (filterCheckboxes) filterCheckboxes.forEach(cb => cb.checked = false);
        const filterInputs = document.querySelectorAll('.filter-price__input');
        if (filterInputs.length == 2) { filterInputs[0].value = ''; filterInputs[1].value = ''; }
        const filterRatings = document.querySelectorAll('.filter-rating');
        if (filterRatings) filterRatings.forEach(el => el.style.color = 'rgba(0,0,0,.8)');
        this.currentRatingFilter = 0;

        this.filterProducts('');
    },

    sortProducts(sortType) {
        switch (sortType) {
            case 'popular':
                this.filteredProducts.sort((a, b) => b.sold - a.sold);
                break;
            case 'newest':
                this.filteredProducts.sort((a, b) => b.id - a.id);
                break;
            case 'best-sellers':
                this.filteredProducts.sort((a, b) => b.sold - a.sold);
                break;
            case 'price-low':
                this.filteredProducts.sort((a, b) => a.price - b.price);
                break;
            case 'price-high':
                this.filteredProducts.sort((a, b) => b.price - a.price);
                break;
        }
        this.currentPage = 1;
        UI.renderProducts(this.getProductsForCurrentPage());
        UI.updatePagination();
    }
};

const Auth = {
    register(email, fullName, phone, password, confirmPassword) {
        if (!email || !fullName || !phone || !password || !confirmPassword) {
            UI.showAlert('Vui lòng điền đầy đủ thông tin', 'error');
            return false;
        }

        if (password !== confirmPassword) {
            UI.showAlert('Mật khẩu không khớp', 'error');
            return false;
        }

        if (password.length < 6) {
            UI.showAlert('Mật khẩu phải có ít nhất 6 ký tự', 'error');
            return false;
        }

        if (!this.isValidEmail(email)) {
            UI.showAlert('Email không hợp lệ', 'error');
            return false;
        }

        const existingUsers = JSON.parse(localStorage.getItem('users') || '[]');
        if (existingUsers.find(u => u.email === email)) {
            UI.showAlert('Email này đã được đăng ký', 'error');
            return false;
        }

        const newUser = {
            id: Date.now(),
            email,
            fullName,
            phone,
            password,
            createdAt: new Date().toISOString()
        };

        existingUsers.push(newUser);
        localStorage.setItem('users', JSON.stringify(existingUsers));

        AppState.currentUser = {
            id: newUser.id,
            email: newUser.email,
            fullName: newUser.fullName,
            phone: newUser.phone
        };
        AppState.saveToLocalStorage();

        UI.showAlert('Đăng ký thành công!', 'success');
        return true;
    },

    login(email, password) {
        if (!email || !password) {
            UI.showAlert('Vui lòng nhập email và mật khẩu', 'error');
            return false;
        }

        const users = JSON.parse(localStorage.getItem('users') || '[]');
        const user = users.find(u => u.email === email && u.password === password);

        if (!user) {
            UI.showAlert('Email hoặc mật khẩu không chính xác', 'error');
            return false;
        }

        AppState.currentUser = {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            phone: user.phone
        };
        AppState.saveToLocalStorage();

        UI.showAlert('Đăng nhập thành công!', 'success');
        return true;
    },

    logout() {
        AppState.currentUser = null;
        AppState.saveToLocalStorage();
        UI.updateUserUI();
        UI.showAlert('Đã đăng xuất', 'success');
        closeAuthModal();
    },

    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
};

const CartManager = {
    addToCart(productId, quantity = 1) {
        const product = AppState.products.find(p => p.id === productId);
        if (!product) return false;

        const existingItem = AppState.cart.find(item => item.id === productId);

        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            AppState.cart.push({
                id: productId,
                name: product.name,
                price: product.price,
                image: product.image,
                quantity: quantity
            });
        }

        AppState.saveToLocalStorage();
        UI.updateCartCount();
        UI.showAlert('Đã thêm vào giỏ hàng!', 'success');
        return true;
    },

    removeFromCart(productId) {
        AppState.cart = AppState.cart.filter(item => item.id !== productId);
        AppState.saveToLocalStorage();
        UI.updateCartCount();
        UI.showAlert('Đã xóa sản phẩm khỏi giỏ hàng', 'success');
    },

    updateQuantity(productId, quantity) {
        const item = AppState.cart.find(item => item.id === productId);
        if (item) {
            item.quantity = Math.max(1, quantity);
            AppState.saveToLocalStorage();
        }
    },

    getTotal() {
        return AppState.cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    },

    checkoutItems(itemIdsMap) {
        // itemIdsMap is an array of checked cart item IDs
        const itemsToPurchase = AppState.cart.filter(item => itemIdsMap.includes(item.id));
        if (itemsToPurchase.length > 0) {
            AppState.purchases.push(...itemsToPurchase);
            // remove from cart
            AppState.cart = AppState.cart.filter(item => !itemIdsMap.includes(item.id));
            AppState.saveToLocalStorage();
            UI.updateCartCount();
        }
    }
};

const UI = {
    showAlert(message, type = 'info') {
        const alertDiv = document.createElement('div');
        alertDiv.innerHTML = `<i class="fa-solid fa-${type === 'success' ? 'circle-check' : type === 'error' ? 'circle-xmark' : 'circle-info'}" style="margin-right: 10px; font-size: 2.2rem;"></i> <span style="font-weight: 500;">${message}</span>`;
        alertDiv.style.cssText = `
            position: fixed;
            top: 40px;
            left: 50%;
            transform: translateX(-50%);
            padding: 16px 30px;
            background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
            color: white;
            border-radius: 4px;
            z-index: 10000;
            display: flex;
            align-items: center;
            font-size: 1.8rem;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: fadeInDown 0.3s ease-out;
        `;
        document.body.appendChild(alertDiv);
        setTimeout(() => alertDiv.remove(), 3000);
    },

    renderFlashSale(products) {
        const flashSaleList = document.querySelector('.flash-sale__list');
        if (!flashSaleList) return;

        flashSaleList.innerHTML = '';

        // Let's render the top 6 requested products for flash sale based on high discount 
        // For simplicity, we just take the first 6 products that have discounts
        const flashSaleProducts = products.filter(p => p.discount > 0).slice(0, 6);

        flashSaleProducts.forEach(product => {
            const itemHTML = `
                <div class="flash-sale__item" data-product-id="${product.id}" onclick="showProductDetail(${JSON.stringify(product).replace(/"/g, '&quot;')})">
                    <div class="flash-sale__img-wrap"><img
                            src="${product.image}"
                            onerror="this.src='https://placehold.co/200x200?text=Image'" alt="${product.name}">
                        <div class="flash-sale__discount"><span
                                style="display:block; font-size: 1rem; color: #ee4d2d; text-transform: uppercase;">Giảm</span><span
                                style="display:block; font-size: 1.2rem; font-weight: 700; color: #ee4d2d;">${product.discount}%</span>
                        </div>
                        <div class="product__item-love" style="left: -4px;">Yêu thích</div>
                    </div>
                    <div class="flash-sale__price">${product.price.toLocaleString('vi-VN')} ₫</div>
                    <div class="flash-sale__progress">
                        <div class="flash-sale__progress-bar" style="width: ${Math.min((product.sold / 100), 100)}%"></div>
                        <div class="flash-sale__progress-text">Đã bán ${product.sold}</div>
                    </div>
                </div>
            `;
            flashSaleList.insertAdjacentHTML('beforeend', itemHTML);
        });
    },

    renderProducts(products) {
        const productContainer = document.querySelector('.home__product .row');
        if (!productContainer) return;

        const existingCols = productContainer.querySelectorAll('.col');
        existingCols.forEach(col => {
            if (col.querySelector('.home__product-item')) {
                col.remove();
            }
        });

        products.forEach(product => {
            const colDiv = document.createElement('div');
            colDiv.className = 'col l-2-4 m-4 c-6';
            colDiv.innerHTML = `
        <a href="javascript:void(0)" class="home__product-item" data-product-id="${product.id}">
          <div class="product__item-img" style="background-image: url('${product.image}')">
            <img class="product__item-sale-img" src="./assets/img/sale3-3.png" alt="Sale">
          </div>
          <h4 class="product__item-heading">${product.name}</h4>
          <div class="product__item-price">
            <span class="product__item-price-old">₫${product.originalPrice.toLocaleString('vi-VN')}</span>
            <span class="product__item-price-current">₫${product.price.toLocaleString('vi-VN')}</span>
          </div>
          <div class="product__item-action">
            <div class="product__action-star-wrap">${this.renderStars(product.rating)}</div>
            <span class="product__action-sold">Đã bán ${(product.sold / 1000).toFixed(1)}k</span>
          </div>
          <span class="product__item-province">${product.location}</span>
          <div class="product__item-love">Yêu thích+</div>
          <div class="product__item-discount">-${product.discount}%</div>
        </a>
      `;
            productContainer.appendChild(colDiv);
        });

        this.attachProductClickListeners();
    },

    renderStars(rating) {
        let starsHTML = '';
        for (let i = 1; i <= 5; i++) {
            const color = i <= rating ? '#ffce3d' : '#d5d5d5';
            starsHTML += `<span class="product__action-star"><i class="fa-solid fa-star" style="color: ${color};"></i></span>`;
        }
        return starsHTML;
    },

    updatePagination() {
        const paginationContainer = document.querySelector('.pagination');
        if (!paginationContainer) return;

        paginationContainer.innerHTML = '';
        const totalPages = AppState.getTotalPages();

        const prevLi = document.createElement('li');
        prevLi.className = `pagination__item ${AppState.currentPage === 1 ? 'pagination__item--disabled' : ''}`;
        const prevBtn = document.createElement('a');
        prevBtn.href = 'javascript:void(0)';
        prevBtn.innerHTML = '<i class="mr-10 pagination__item-icon fa fa-angle-left"></i>';
        prevBtn.onclick = (e) => {
            e.preventDefault();
            if (AppState.currentPage > 1) {
                AppState.setCurrentPage(AppState.currentPage - 1);
                UI.renderProducts(AppState.getProductsForCurrentPage());
                UI.updatePagination();
                window.scrollTo(0, 0);
            }
        };
        prevLi.appendChild(prevBtn);
        paginationContainer.appendChild(prevLi);

        const startPage = Math.max(1, AppState.currentPage - 2);
        const endPage = Math.min(totalPages, AppState.currentPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            const pageLi = document.createElement('li');
            pageLi.className = `pagination__item ${i === AppState.currentPage ? 'pagination__item-active' : ''}`;
            const pageBtn = document.createElement('a');
            pageBtn.href = 'javascript:void(0)';
            pageBtn.className = 'pagination__item-link';
            pageBtn.textContent = i;
            pageBtn.onclick = (e) => {
                e.preventDefault();
                AppState.setCurrentPage(i);
                UI.renderProducts(AppState.getProductsForCurrentPage());
                UI.updatePagination();
            };
            pageLi.appendChild(pageBtn);
            paginationContainer.appendChild(pageLi);
        }

        const nextLi = document.createElement('li');
        nextLi.className = `pagination__item ${AppState.currentPage === totalPages ? 'pagination__item--disabled' : ''}`;
        const nextBtn = document.createElement('a');
        nextBtn.href = 'javascript:void(0)';
        nextBtn.innerHTML = '<i class="ml-10 pagination__item-icon fa fa-angle-right"></i>';
        nextBtn.onclick = (e) => {
            e.preventDefault();
            if (AppState.currentPage < totalPages) {
                AppState.setCurrentPage(AppState.currentPage + 1);
                UI.renderProducts(AppState.getProductsForCurrentPage());
                UI.updatePagination();
            }
        };
        nextLi.appendChild(nextBtn);
        paginationContainer.appendChild(nextLi);

        // Update Top Pagination
        const selectNumTotal = document.querySelector('.home__select-page-num');
        if (selectNumTotal) selectNumTotal.innerHTML = `<span class="select__number">${AppState.currentPage}</span>/${totalPages}`;

        const topControls = document.querySelectorAll('.select__control-btn');
        if (topControls.length === 2) {
            topControls[0].className = `select__control-btn ${AppState.currentPage === 1 ? 'select__control-btn-disable' : ''}`;
            topControls[0].onclick = (e) => {
                e.preventDefault();
                if (AppState.currentPage > 1) {
                    AppState.setCurrentPage(AppState.currentPage - 1);
                    UI.renderProducts(AppState.getProductsForCurrentPage());
                    UI.updatePagination();
                }
            };

            topControls[1].className = `select__control-btn ${AppState.currentPage === totalPages ? 'select__control-btn-disable' : ''}`;
            topControls[1].onclick = (e) => {
                e.preventDefault();
                if (AppState.currentPage < totalPages) {
                    AppState.setCurrentPage(AppState.currentPage + 1);
                    UI.renderProducts(AppState.getProductsForCurrentPage());
                    UI.updatePagination();
                }
            };
        }
    },

    updateCartCount() {
        const cartCount = document.querySelector('.cart__item-count');
        if (cartCount) cartCount.textContent = AppState.cart.length;

        // Sync drawer badge
        const drawerBadges = document.querySelectorAll('.drawer-cart-badge');
        drawerBadges.forEach(b => b.textContent = AppState.cart.length);

        const cartBody = document.querySelector('.cart__body');
        const cartWrap = document.querySelector('.header__cart-wrap');
        const cartNoImg = document.querySelector('.cart-container__img');

        if (cartBody && cartWrap && cartNoImg) {
            if (AppState.cart.length === 0) {
                cartWrap.style.display = 'none';
                cartNoImg.style.display = 'block';
            } else {
                cartWrap.style.display = 'block';
                cartNoImg.style.display = 'none';
                cartBody.innerHTML = AppState.cart.map(item => `
                    <li class="cart__body-item" style="padding: 10px 0; border-bottom: 1px solid #f5f5f5; display: flex; align-items: center;">
                        <img src="${item.image}" alt="" class="cart__body-img" style="width: 40px; height: 40px; border: 1px solid #e8e8e8; margin-right: 10px;">
                        <div class="cart__body-info" style="flex: 1;">
                            <h4 class="cart__body-info-name" style="margin: 0; font-size: 1.4rem; font-weight: 500; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; color: #333;">${item.name}</h4>
                            <span class="cart__body-info-price" style="color: #ee4d2d; font-size: 1.4rem;">₫${item.price.toLocaleString('vi-VN')}</span>
                        </div>
                        <span class="cart__body-delete" onclick="CartManager.removeFromCart(${item.id})" style="font-size: 1.4rem; color: #333; cursor: pointer; padding: 0 5px; opacity: 0.8;">Xóa</span>
                    </li>
                `).join('');

                // Bind the Cart Modal
                const cartFooterBtn = document.querySelector('.cart__footer button');
                if (cartFooterBtn) {
                    cartFooterBtn.setAttribute('onclick', 'showCartModal()');
                }
            }
        }
    },

    updateUserUI() {
        const authLoginItem = document.getElementById('auth-login-item');
        const authSignupItem = document.getElementById('auth-signup-item');
        const notificationFooter = document.querySelector('.notification__footer');
        const notificationImg = document.querySelector('.img__login-please');
        const notificationSpan = document.querySelector('.navbar__footer-img');
        const mobileUserAvatar = document.getElementById('mobile-user-avatar');

        if (!authLoginItem || !authSignupItem) return;

        if (AppState.currentUser) {
            authSignupItem.style.display = 'none';
            authLoginItem.innerHTML = `
                <img src="${AppState.currentUser.avatar || `https://i.pravatar.cc/150?u=${AppState.currentUser.id}`}" alt="Avatar" style="width: 22px; height: 22px; border-radius: 50%; object-fit: cover; margin-right: 5px; border: 1px solid rgba(0,0,0,0.1);">
                <span class="navbar__user-name" style="font-weight: 500; font-size: 1.4rem;">${AppState.currentUser.fullName}</span>
                <ul class="navbar__user-menu">
                    <li class="navbar__user-item"><a href="javascript:void(0)" onclick="showAccountModal()">Tài khoản của tôi</a></li>
                    <li class="navbar__user-item"><a href="javascript:void(0)" onclick="showPurchaseModal()">Đơn mua</a></li>
                    <li class="navbar__user-item navbar__user-item--separate"><a href="javascript:void(0)" onclick="Auth.logout()">Đăng xuất</a></li>
                </ul>
            `;
            authLoginItem.onclick = null;
            if (notificationFooter) notificationFooter.style.display = 'none';
            if (notificationImg) notificationImg.style.display = 'none';
            if (notificationSpan) notificationSpan.textContent = 'Trống';

            if (mobileUserAvatar) {
                mobileUserAvatar.innerHTML = `<img src="${AppState.currentUser.avatar || `https://i.pravatar.cc/150?u=${AppState.currentUser.id}`}" alt="Avatar" style="width: 26px; height: 26px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(255,255,255,0.4);" onclick="showAccountModal()">`;
            }

            // Sync Drawer Profile (Logged In)
            const drawerProfileAuth = document.getElementById('drawerProfileAuth');
            if (drawerProfileAuth) {
                drawerProfileAuth.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
                        <div class="drawer-profile__info" style="cursor: pointer;" onclick="closeMobileDrawer(); showAccountModal()">
                            <img src="${AppState.currentUser.avatar || `https://i.pravatar.cc/150?u=${AppState.currentUser.id}`}" alt="Avatar" style="width: 45px; height: 45px; border-radius: 50%; object-fit: cover; border: 1px solid #e8e8e8;">
                            <div class="drawer-profile__text">
                                <h3 class="drawer-profile__name">${AppState.currentUser.fullName}</h3>
                                <span class="drawer-profile__status" style="color: #28a745;">Thành viên Vàng</span>
                            </div>
                        </div>
                        <button class="drawer-close-btn" onclick="closeMobileDrawer()" style="background: none; border: none; font-size: 3.2rem; line-height: 1; color: #999; cursor: pointer; padding: 0 5px;">&times;</button>
                    </div>
                    <button class="drawer-profile__logout-btn" onclick="closeMobileDrawer(); Auth.logout()">Đăng xuất</button>
                `;
            }
        } else {
            authSignupItem.style.display = 'inline-block';
            authSignupItem.textContent = 'Đăng ký';
            authSignupItem.onclick = () => openAuthModal('signup');

            authLoginItem.innerHTML = `<span class="navbar__user-name" style="font-size: 1.4rem;">Đăng nhập</span>`;
            authLoginItem.onclick = () => openAuthModal('login');

            if (notificationFooter) notificationFooter.style.display = 'flex';
            if (notificationImg) notificationImg.style.display = 'block';
            if (notificationSpan) notificationSpan.textContent = 'Đăng nhập để xem Thông báo';

            if (mobileUserAvatar) {
                mobileUserAvatar.innerHTML = `<i class="fa-regular fa-circle-user" style="font-size: 2.6rem; color: #fff;" onclick="openAuthModal('login')"></i>`;
            }

            // Sync Drawer Profile (Logged Out)
            const drawerProfileAuth = document.getElementById('drawerProfileAuth');
            if (drawerProfileAuth) {
                drawerProfileAuth.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
                        <div class="drawer-profile__info" onclick="closeMobileDrawer(); openAuthModal('login')" style="cursor: pointer;">
                            <i class="fa-regular fa-circle-user" style="font-size: 4rem; color: #ccc;"></i>
                            <div class="drawer-profile__text">
                                <h3 class="drawer-profile__name">Khách</h3>
                                <span class="drawer-profile__status">Đăng nhập / Đăng ký</span>
                            </div>
                        </div>
                        <button class="drawer-close-btn" onclick="closeMobileDrawer()" style="background: none; border: none; font-size: 3.2rem; line-height: 1; color: #999; cursor: pointer; padding: 0 5px;">&times;</button>
                    </div>
                `;
            }
        }
    },

    attachProductClickListeners() {
        document.querySelectorAll('.home__product-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.product__item-love')) {
                    e.preventDefault();
                    UI.showAlert('Đã thêm vào danh sách yêu thích!', 'success');
                    return;
                }
                e.preventDefault();
                const productId = parseInt(item.getAttribute('data-product-id'));
                const product = AppState.products.find(p => p.id === productId);
                showProductDetail(product);
            });
        });
    }
};

function openAuthModal(mode) {
    const modal = document.querySelector('.auth-modal');
    if (!modal) createAuthModal();
    const newModal = document.querySelector('.auth-modal');
    if (newModal) {
        newModal.classList.remove('auth-modal--hidden');
        showAuthForm(mode);
    }
}

function closeAuthModal() {
    const modal = document.querySelector('.auth-modal');
    if (modal) modal.classList.add('auth-modal--hidden');
}

function createAuthModal() {
    const modal = document.createElement('div');
    modal.className = 'auth-modal auth-modal--hidden';
    modal.innerHTML = `
    <div class="auth-modal__overlay"></div>
    <div class="auth-modal__content">
      <div class="auth-modal__header">
        <span class="auth-modal__title">Xác thực tài khoản</span>
        <button class="auth-modal__close" onclick="closeAuthModal()">&times;</button>
      </div>
      <div class="auth-modal__body" id="authBody"></div>
    </div>
  `;
    document.body.appendChild(modal);
    modal.querySelector('.auth-modal__overlay').addEventListener('click', closeAuthModal);

    const style = document.createElement('style');
    style.textContent = `
    .auth-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .auth-modal--hidden { display: none !important; }
    .auth-modal__overlay {
      position: absolute;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
    }
    .auth-modal__content {
      position: relative;
      background: white;
      border-radius: 8px;
      width: 90%;
      max-width: 400px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    }
    .auth-modal__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid #e8e8e8;
    }
    .auth-modal__title { font-size: 18px; font-weight: 600; }
    .auth-modal__close {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #999;
    }
    .auth-modal__body { padding: 20px; }
    .auth-form__group { margin-bottom: 15px; }
    .auth-form__label {
      display: block;
      margin-bottom: 5px;
      font-weight: 500;
      font-size: 14px;
    }
    .auth-form__input {
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
      box-sizing: border-box;
    }
    .auth-form__input:focus {
      outline: none;
      border-color: #ee4d2b;
      box-shadow: 0 0 0 2px rgba(238, 77, 43, 0.1);
    }
    .auth-form__checkbox {
      display: flex;
      align-items: center;
      margin-bottom: 15px;
      font-size: 14px;
    }
    .auth-form__checkbox input { margin-right: 8px; cursor: pointer; }
    .auth-form__button {
      width: 100%;
      padding: 10px;
      background: #ee4d2b;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      margin-bottom: 10px;
    }
    .auth-form__button:hover { background: #d63418; }
    .auth-form__link {
      text-align: center;
      font-size: 14px;
      color: #999;
    }
    .auth-form__link a {
      color: #ee4d2b;
      cursor: pointer;
      text-decoration: none;
    }
  `;
    document.head.appendChild(style);
}

function showAuthForm(mode) {
    const authBody = document.getElementById('authBody');
    if (mode === 'login') {
        authBody.innerHTML = `
      <form class="auth-form" onsubmit="handleLogin(event)">
        <div class="auth-form__group">
          <label class="auth-form__label">Email</label>
          <input type="email" name="email" class="auth-form__input" placeholder="your@email.com" required>
        </div>
        <div class="auth-form__group">
          <label class="auth-form__label">Mật khẩu</label>
          <input type="password" name="password" class="auth-form__input" placeholder="Tối thiểu 6 ký tự" minlength="6" required>
        </div>
        <div class="auth-form__checkbox">
          <input type="checkbox" name="rememberMe" id="rememberMe">
          <label for="rememberMe" style="margin: 0;">Ghi nhớ mật khẩu</label>
        </div>
        <button type="submit" class="auth-form__button">Đăng nhập</button>
        <div class="auth-form__link">Chưa có tài khoản? <a onclick="showAuthForm('signup')">Đăng ký tại đây</a></div>
      </form>
    `;
    } else {
        authBody.innerHTML = `
      <form class="auth-form" onsubmit="handleSignup(event)">
        <div class="auth-form__group">
          <label class="auth-form__label">Email</label>
          <input type="email" name="email" class="auth-form__input" placeholder="your@email.com" required>
        </div>
        <div class="auth-form__group">
          <label class="auth-form__label">Họ và tên</label>
          <input type="text" name="fullName" class="auth-form__input" placeholder="Nhập họ và tên" required>
        </div>
        <div class="auth-form__group">
          <label class="auth-form__label">Số điện thoại</label>
          <input type="tel" name="phone" class="auth-form__input" placeholder="0987654321" required>
        </div>
        <div class="auth-form__group">
          <label class="auth-form__label">Mật khẩu</label>
          <input type="password" name="password" class="auth-form__input" placeholder="Tối thiểu 6 ký tự" minlength="6" required>
        </div>
        <div class="auth-form__group">
          <label class="auth-form__label">Nhập lại mật khẩu</label>
          <input type="password" name="confirmPassword" class="auth-form__input" placeholder="Nhập lại mật khẩu" required>
        </div>
        <button type="submit" class="auth-form__button">Đăng ký</button>
        <div class="auth-form__link">Đã có tài khoản? <a onclick="showAuthForm('login')">Đăng nhập tại đây</a></div>
      </form>
    `;
    }
}

function handleLogin(event) {
    event.preventDefault();
    const form = event.target;
    if (Auth.login(form.email.value, form.password.value)) {
        closeAuthModal();
        UI.updateUserUI();
    }
}

function handleSignup(event) {
    event.preventDefault();
    const form = event.target;
    if (Auth.register(form.email.value, form.fullName.value, form.phone.value, form.password.value, form.confirmPassword.value)) {
        closeAuthModal();
        UI.updateUserUI();
    }
}

function showProductDetail(product) {
    if (!product) return;
    const modal = document.createElement('div');
    modal.id = 'productDetailModal';
    modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999;
  `;

    const totalStars = Array.from({ length: 5 }, (_, i) =>
        `<i class="fa-solid fa-star" style="color: ${i < product.rating ? '#ffce3d' : '#d5d5d5'};"></i>`
    ).join('');

    // Prepend dynamic styling for responsive layout inside modals specifically accommodating Mobile views
    const styleId = 'productDetailResponsiveStyle';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .prod-modal-content { display: flex; gap: 24px; padding: 24px; }
            .prod-modal-img { width: 280px; height: 280px; object-fit: cover; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); flex-shrink: 0; }
            .prod-modal-info { flex: 1; min-width: 0; }
            .prod-modal-title { margin: 0; font-size: 2.2rem; color: #333; line-height: 1.4; margin-bottom: 20px;}
            .prod-modal-price { margin-bottom: 20px;}
            .prod-modal-price-val { font-size: 3rem; color: #ee4d2b; font-weight: 500;}
            .prod-modal-strike { margin-left: 14px; text-decoration: line-through; color: #999; font-size: 1.6rem;}
            .prod-modal-rating { margin-bottom: 15px; font-size: 1.6rem;}
            .prod-modal-desc { color: #555; margin: 15px 0; font-size: 1.5rem; line-height: 1.5;}
            .prod-modal-loc { color: #888; font-size: 1.4rem;}
            .prod-modal-actions { margin-top: 25px; display: flex; gap: 10px; align-items: center; justify-content: space-between; flex-wrap: wrap;}
            .prod-modal-actions input { width: 50px; height: 38px; padding: 5px; border: 1px solid #ddd; border-radius: 2px; text-align: center; font-size: 1.4rem; outline: none; }
            .prod-modal-btn-cart { flex: 1; min-width: 140px; padding: 10px; background: rgba(238,77,43,0.1); color: #ee4d2b; border: 1px solid #ee4d2b; border-radius: 2px; font-size: 1.4rem; cursor: pointer; transition: background 0.2s; white-space: nowrap;}
            .prod-modal-btn-buy { flex: 1; min-width: 140px; padding: 10px; background: #ee4d2b; color: white; border: none; border-radius: 2px; font-size: 1.4rem; cursor: pointer; transition: background 0.2s; white-space: nowrap;}
            @media (max-width: 739px) {
                .prod-modal-content { flex-direction: column; gap: 15px; padding: 15px; align-items: center; }
                .prod-modal-img { width: 100%; max-width: 250px; height: auto; }
                .prod-modal-title { font-size: 1.8rem; margin-bottom: 10px; text-align: center; }
                .prod-modal-price-val { font-size: 2.2rem; }
                .prod-modal-rating { font-size: 1.4rem; }
                .prod-modal-actions { justify-content: center; width: 100%; }
                .prod-modal-actions input { width: 45px; height: 36px; }
                .prod-modal-btn-cart, .prod-modal-btn-buy { min-width: 110px; padding: 8px; font-size: 1.2rem; padding: 10px 5px;}
            }
        `;
        document.head.appendChild(style);
    }

    modal.innerHTML = `
    <div style="background: white; border-radius: 4px; width: 90%; max-width: 800px; max-height: 90vh; overflow-y: auto; position: relative;">
      <div style="display: flex; justify-content: flex-end; padding: 10px 10px 0;">
        <button onclick="document.getElementById('productDetailModal').remove()" style="background: none; border: none; font-size: 2.4rem; cursor: pointer; color: #999; line-height: 1;">&times;</button>
      </div>
      <div class="prod-modal-content">
        <img src="${product.image}" alt="${product.name}" class="prod-modal-img">
        <div class="prod-modal-info">
          <h2 class="prod-modal-title">${product.name}</h2>
          <div class="prod-modal-price">
            <span class="prod-modal-price-val">₫${product.price.toLocaleString('vi-VN')}</span>
            <span class="prod-modal-strike">₫${product.originalPrice.toLocaleString('vi-VN')}</span>
          </div>
          <div class="prod-modal-rating">
            ${totalStars}
            <span style="margin-left: 10px; color: #777;">${product.rating}/5 | Đã bán ${(product.sold / 1000).toFixed(1)}k</span>
          </div>
          <p class="prod-modal-desc">${product.description}</p>
          <p class="prod-modal-loc"><strong>Khu vực:</strong> ${product.location}</p>
          
          <div class="prod-modal-actions">
            <input type="number" id="quantity" value="1" min="1" max="100">
            <button class="prod-modal-btn-cart" onclick="addToCart(${product.id})"><i class="fa-solid fa-cart-plus"></i> Thêm Vào Giỏ</button>
            <button class="prod-modal-btn-buy" onclick="buyNow(${product.id})">Mua Ngay</button>
          </div>
        </div>
      </div>
    </div>
  `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

function addToCart(productId) {
    if (!AppState.currentUser) {
        UI.showAlert('Vui lòng đăng nhập để thêm vào giỏ hàng', 'error');
        openAuthModal('login');
        const detailModal = document.getElementById('productDetailModal');
        if (detailModal) detailModal.remove();
        return;
    }
    const quantity = parseInt(document.getElementById('quantity').value) || 1;
    CartManager.addToCart(productId, quantity);
    const detailModal = document.getElementById('productDetailModal');
    if (detailModal) detailModal.remove();
}

function buyNow(productId) {
    if (!AppState.currentUser) {
        UI.showAlert('Vui lòng đăng nhập để mua hàng', 'error');
        openAuthModal('login');
        const detailModal = document.getElementById('productDetailModal');
        if (detailModal) detailModal.remove();
        return;
    }
    const quantity = parseInt(document.getElementById('quantity').value) || 1;
    const product = AppState.products.find(p => p.id === productId);

    if (product) {
        AppState.purchases.push({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            quantity: quantity,
            date: new Date().toISOString()
        });
        AppState.saveToLocalStorage();
    }

    const detailModal = document.getElementById('productDetailModal');
    if (detailModal) detailModal.remove();
    UI.showAlert('Thanh toán thành công! Xem trong Đơn Mua', 'success');
}

function initApp() {
    AppState.init();

    // Banner Slider Logic
    let currentBannerIndex = 0;
    let bannerInterval;
    const bannerSlider = document.getElementById('bannerSlider');
    const bannerDots = document.querySelectorAll('.shopee-banners__dot');

    if (bannerSlider && bannerDots.length) {
        bannerInterval = setInterval(() => moveBanner(1), 4000);

        window.moveBanner = function (direction) {
            currentBannerIndex += direction;
            if (currentBannerIndex >= bannerDots.length) currentBannerIndex = 0;
            if (currentBannerIndex < 0) currentBannerIndex = bannerDots.length - 1;
            updateBannerUI();
        };

        window.currentBanner = function (index) {
            currentBannerIndex = index;
            updateBannerUI();
            clearInterval(bannerInterval);
            bannerInterval = setInterval(() => moveBanner(1), 4000);
        };

        function updateBannerUI() {
            bannerSlider.style.transform = `translateX(-${currentBannerIndex * 100}%)`;
            bannerDots.forEach((dot, idx) => {
                if (idx === currentBannerIndex) dot.classList.add('active');
                else dot.classList.remove('active');
            });
        }
    }

    // Flash Sale Timer Logic (duoi 30 minutes)
    const timerSpans = document.querySelectorAll('.flash-sale__time');
    if (timerSpans.length === 3) {
        let totalSeconds = 30 * 60; // 30 minutes
        setInterval(() => {
            if (totalSeconds <= 0) return;
            totalSeconds--;
            const h = Math.floor(totalSeconds / 3600);
            const m = Math.floor((totalSeconds % 3600) / 60);
            const s = Math.floor(totalSeconds % 60);
            timerSpans[0].textContent = h.toString().padStart(2, '0');
            timerSpans[1].textContent = m.toString().padStart(2, '0');
            timerSpans[2].textContent = s.toString().padStart(2, '0');
        }, 1000);
    }

    // Search Autocomplete / Suggestions
    const searchInput = document.querySelector('.found__input');
    const searchSuggestionList = document.querySelector('#searchSuggestionList');
    const searchSuggestionBox = document.querySelector('#searchSuggestionBox');
    const searchSuggestionHeading = document.getElementById('searchSuggestionHeading');

    window.deletePurchaseHistory = function () {
        if (confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử đơn mua?')) {
            AppState.purchases = [];
            AppState.saveToLocalStorage();
            UI.showAlert('Đã xóa toàn bộ lịch sử đơn mua', 'success');

            // Xóa phần tử modal khỏi DOM sau khi thao tác
            const modalEl = document.querySelector('.purchase-modal-container');
            if (modalEl && modalEl.parentElement && modalEl.parentElement.parentElement) {
                modalEl.parentElement.parentElement.remove();
            }
        }
    };

    // =========================================
    // MOBILE DRAWER MENU LOGIC
    // =========================================
    window.openMobileDrawer = function () {
        const drawer = document.getElementById('mobileDrawer');
        const overlay = document.getElementById('mobileDrawerOverlay');
        if (drawer && overlay) {
            overlay.style.display = 'block';
            // force reflow
            void overlay.offsetWidth;
            overlay.style.opacity = '1';
            drawer.classList.add('active');
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
        }
    };

    window.closeMobileDrawer = function () {
        const drawer = document.getElementById('mobileDrawer');
        const overlay = document.getElementById('mobileDrawerOverlay');
        if (drawer && overlay) {
            drawer.classList.remove('active');
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.style.display = 'none';
                document.body.style.overflow = 'auto'; // Restore background scrolling
            }, 300);
        }
    };

    window.applyDrawerFilters = function () {
        // Collect settings from Drawer
        const locationVal = document.getElementById('drawerLocationSelect').value;
        const catRadio = document.querySelector('input[name="drawer-category"]:checked');
        const minP = document.getElementById('drawerPriceMin').value;
        const maxP = document.getElementById('drawerPriceMax').value;

        // 1. Sync Category FIRST (Because AppState.setCategory clears Advanced Filters UI natively)
        if (catRadio) {
            AppState.setCategory(catRadio.value); // This automatically triggers filterProducts('') and UI clears
        }

        // Now overlay the advanced UI state with the Drawer's state

        // 2. Sync Location
        const filterGroups = document.querySelectorAll('.filter-group');
        let locationGroup = null;
        filterGroups.forEach(g => {
            const h4 = g.querySelector('h4');
            if (h4 && h4.textContent.includes('Nơi Bán')) {
                locationGroup = g;
            }
        });

        if (locationGroup) {
            const locationCheckboxes = locationGroup.querySelectorAll('input[type="checkbox"]');
            locationCheckboxes.forEach(cb => {
                cb.checked = false; // Reset first
                if (locationVal && locationVal !== 'all') {
                    const spanText = cb.nextElementSibling.textContent.trim().replace(/\s+/g, ' ');
                    if (spanText.includes(locationVal)) {
                        cb.checked = true;
                    }
                }
            });
        }

        // 3. Sync Prices
        const desktopPrices = document.querySelectorAll('.filter-price__input');
        if (desktopPrices.length === 2) {
            desktopPrices[0].value = minP || '';
            desktopPrices[1].value = maxP || '';
        }

        // Execute filter pipeline explicitly with new UI state
        if (typeof window.runAdvancedFilters === 'function') {
            window.runAdvancedFilters();
        }
    };

    window.clearDrawerFilters = function () {
        // Reset Drawer State
        document.getElementById('drawerLocationSelect').value = 'all';
        document.getElementById('drawerPriceMin').value = '';
        document.getElementById('drawerPriceMax').value = '';

        const allDrawerRadios = document.querySelectorAll('input[name="drawer-category"]');
        allDrawerRadios.forEach(radio => {
            if (radio.value === 'all') {
                radio.checked = true;
            } else {
                radio.checked = false;
            }
        });

        // Trigger desktop sync explicitly with cleared state
        window.applyDrawerFilters();
    };

    // Bind overlay click to close drawer
    const overlay = document.getElementById('mobileDrawerOverlay');
    if (overlay) {
        overlay.addEventListener('click', closeMobileDrawer);
    }

    // Bind hamburger button
    const hambBtn = document.getElementById('mobile-menu-btn');
    if (hambBtn) {
        hambBtn.addEventListener('click', openMobileDrawer);
    }

    // Bind instant mobile drawer filtering
    const drawerLocation = document.getElementById('drawerLocationSelect');
    if (drawerLocation) {
        drawerLocation.addEventListener('change', window.applyDrawerFilters);
    }
    const drawerCats = document.querySelectorAll('input[name="drawer-category"]');
    drawerCats.forEach(radio => radio.addEventListener('change', window.applyDrawerFilters));
    window.applySearch = function (term) {
        if (searchInput) {
            searchInput.value = term;
            AppState.filterProducts(term);
            const evt = new Event('input', { bubbles: true });
            searchInput.dispatchEvent(evt);
        }
    };

    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const term = searchInput.value.toLowerCase().trim();
            window.applySearch(term);
        });
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                searchBtn.click();
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase().trim();
            if (term) {
                const matchedProducts = AppState.products.filter(p => p.name.toLowerCase().includes(term));
                if (matchedProducts.length > 0) {
                    searchSuggestionBox.style.display = 'block';
                    searchSuggestionHeading.textContent = 'Gợi ý tìm kiếm';
                    searchSuggestionList.innerHTML = matchedProducts.slice(0, 5).map(p => `
                        <li class="history-product__item" style="padding: 10px 15px; cursor: pointer;">
                            <a class="product__item-link" href="javascript:void(0)" onclick="applySearch('${p.name}')" style="color: var(--text-color); text-decoration: none; font-size: 1.4rem;">${p.name}</a>
                        </li>
                    `).join('');
                } else {
                    searchSuggestionBox.style.display = 'none';
                }
            } else {
                searchSuggestionBox.style.display = 'none';
            }
            AppState.filterProducts(term);
        });

        // Hide/Show suggestions based on focus
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.header__found-input')) {
                if (searchSuggestionBox) searchSuggestionBox.style.display = 'none';
            }
        });
        searchInput.addEventListener('focus', () => {
            if (searchSuggestionList && searchSuggestionList.children.length > 0) searchSuggestionBox.style.display = 'block';
        });
    }

    // Sorting logic including dynamic "Giá" toggle
    const sortButtons = document.querySelectorAll('.home__filter-btn, .header__sort-link');
    let isPriceLowToHigh = true;

    sortButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const buttonText = btn.textContent.trim();
            const icon = btn.querySelector('i');

            let sortType = 'popular';

            if (buttonText.includes('Mới nhất')) sortType = 'newest';
            else if (buttonText.includes('Bán chạy')) sortType = 'best-sellers';
            else if (buttonText.includes('Giá')) {
                // Toggle Sort
                isPriceLowToHigh = !isPriceLowToHigh;
                sortType = isPriceLowToHigh ? 'price-low' : 'price-high';

                if (icon) {
                    icon.className = isPriceLowToHigh ? 'fa-solid fa-arrow-down-short-wide' : 'fa-solid fa-arrow-up-wide-short';
                    icon.style.color = '#ee4d2d';
                }
                const sortPriceBtn = document.getElementById('sort-price-btn');
                if (sortPriceBtn && sortPriceBtn !== btn) {
                    const hIcon = sortPriceBtn.querySelector('i');
                    if (hIcon) {
                        hIcon.className = isPriceLowToHigh ? 'fa-solid fa-arrow-down-short-wide' : 'fa-solid fa-arrow-up-wide-short';
                        hIcon.style.color = '#ee4d2d';
                    }
                }
            } else {
                // Reset Price Icon styling if clicked away
                const sortPriceBtn = document.getElementById('sort-price-btn');
                if (sortPriceBtn) {
                    const hIcon = sortPriceBtn.querySelector('i');
                    if (hIcon) {
                        hIcon.className = 'fa-solid fa-arrows-up-down';
                        hIcon.style.color = '';
                    }
                }
            }

            // UI feedback
            document.querySelectorAll('.home__filter-btn').forEach(b => b.classList.remove('btn__primary'));
            if (btn.classList.contains('home__filter-btn')) btn.classList.add('btn__primary');
            else if (btn.classList.contains('header__sort-link')) {
                document.querySelectorAll('.header__sort-item').forEach(i => i.classList.remove('header__sort-item-active'));
                btn.parentElement.classList.add('header__sort-item-active');
            }

            AppState.sortProducts(sortType);
        });
    });

    // Select Price filter restoration
    const priceOptions = document.querySelectorAll('.option__price-link');
    priceOptions.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const priceText = link.textContent.trim();
            if (priceText.startsWith('Giá: Thấp')) {
                AppState.sortProducts('price-low');
            } else if (priceText.startsWith('Giá: Cao')) {
                AppState.sortProducts('price-high');
            }
        });
    });

    // Category click listeners
    const categoryLinks = document.querySelectorAll('.category__item-link');
    categoryLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const catName = link.textContent.trim();
            if (catName.includes('Tất Cả')) AppState.setCategory('all');
            else AppState.setCategory(catName);
        });
    });

    // Advanced Filter logic
    const filterCheckboxes = document.querySelectorAll('.advanced-filters input[type="checkbox"]');
    const filterBtn = document.querySelector('.filter-price__btn');
    const filterClearBtn = document.querySelector('.filter-clear-btn');
    const filterInputs = document.querySelectorAll('.filter-price__input');
    const filterRatings = document.querySelectorAll('.filter-rating');

    // Attach listener to checkbox spans for custom UI logic
    filterCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            // Also sync back to drawer for consistency
            const activeDesktopLocs = Array.from(filterCheckboxes).filter(cb => cb.checked).map(cb => cb.nextElementSibling.textContent.trim().replace(/\s+/g, ' '));
            const drawerLoc = document.getElementById('drawerLocationSelect');
            if (drawerLoc) {
                if (activeDesktopLocs.length > 0) {
                    for (let i = 0; i < drawerLoc.options.length; i++) {
                        if (drawerLoc.options[i].value === activeDesktopLocs[0]) {
                            drawerLoc.selectedIndex = i;
                            break;
                        }
                    }
                } else {
                    drawerLoc.value = 'all';
                }
            }

            if (typeof window.runAdvancedFilters === 'function') {
                window.runAdvancedFilters();
            }
        });
    });

    if (filterBtn) {
        filterBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const minV = filterInputs[0].value;
            const maxV = filterInputs[1].value;
            if (!minV && !maxV) {
                UI.showAlert('Vui lòng điền khoảng giá', 'error');
                return;
            }
            if (typeof window.runAdvancedFilters === 'function') {
                window.runAdvancedFilters();
            }
        });
    }

    if (filterRatings.length > 0) {
        filterRatings.forEach(r => {
            r.addEventListener('click', () => {
                // Reset all, select this one (visually)
                filterRatings.forEach(el => el.style.color = 'rgba(0,0,0,.8)');
                r.style.color = '#ee4d2d';
                // Attach arbitrary data to use in filter
                AppState.currentRatingFilter = parseInt(r.querySelectorAll('.fa-solid.fa-star').length);
                if (typeof window.runAdvancedFilters === 'function') {
                    window.runAdvancedFilters();
                }
            });
        });
    }

    if (filterClearBtn) {
        filterClearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            filterCheckboxes.forEach(cb => cb.checked = false);
            if (filterInputs.length == 2) {
                filterInputs[0].value = '';
                filterInputs[1].value = '';
            }
            filterRatings.forEach(el => el.style.color = 'rgba(0,0,0,.8)');
            AppState.currentRatingFilter = 0;
            // Also reset to All Categories and Clear Search
            const searchInputObj = document.querySelector('.found__input');
            if (searchInputObj) searchInputObj.value = '';
            AppState.setCategory('all'); // This automatically triggers runAdvancedFilters()
        });
    }

    window.runAdvancedFilters = function () {
        let filtered = [...AppState.products];

        // 1. Category Filter
        if (AppState.currentCategory && AppState.currentCategory !== 'all') {
            filtered = filtered.filter(p => p.category && p.category.toLowerCase() === AppState.currentCategory.toLowerCase());
        }

        // 2. Search Box
        const searchInputNode = document.querySelector('.found__input');
        if (searchInputNode && searchInputNode.value.trim() !== '') {
            const term = searchInputNode.value.toLowerCase().trim();
            filtered = filtered.filter(p => p.name.toLowerCase().includes(term) || p.description.toLowerCase().includes(term));
        }

        // 3. Location (Nơi bán)
        const activeLocations = Array.from(filterCheckboxes)
            .filter(cb => cb.checked && cb.closest('.filter-group').querySelector('h4').textContent.includes('Nơi Bán'))
            .map(cb => cb.nextElementSibling.textContent.trim().replace(/\s+/g, ' '));

        if (activeLocations.length > 0) {
            filtered = filtered.filter(p => activeLocations.some(loc => p.location && p.location.includes(loc)));
        }

        // 4. Price filtering
        if (filterInputs.length === 2) {
            const minV = parseInt(filterInputs[0].value) || 0;
            const maxV = parseInt(filterInputs[1].value) || Infinity;
            if (minV > 0 || maxV < Infinity) {
                filtered = filtered.filter(p => p.price >= minV && p.price <= maxV);
            }
        }

        // 5. Rating filtering
        if (AppState.currentRatingFilter) {
            filtered = filtered.filter(p => p.rating >= AppState.currentRatingFilter);
        }

        AppState.filteredProducts = filtered;
        AppState.currentPage = 1;
        UI.renderProducts(AppState.getProductsForCurrentPage());
        UI.updatePagination();
    };
} // end initApp

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// Modals for Account and Purchases
window.showAccountModal = function () {
    if (!AppState.currentUser) return;
    const modal = document.createElement('div');
    modal.style.cssText = `position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;`;

    window.saveUserProfile = async function () {
        const newPhone = document.getElementById('edit-phone-input').value;
        const newPass = document.getElementById('edit-pass-input').value;
        const avatarFile = document.getElementById('edit-avatar-file').files[0];

        let users = JSON.parse(localStorage.getItem('users') || '[]');
        let userIndex = users.findIndex(u => u.id === AppState.currentUser.id);

        if (userIndex !== -1) {
            if (newPhone) users[userIndex].phone = newPhone;
            if (newPass.length >= 6) users[userIndex].password = newPass;
            else if (newPass.length > 0) { UI.showAlert('Mật khẩu tối thiểu 6 ký tự', 'error'); return; }

            // Handle FileReader if Avatar File Exists
            if (avatarFile) {
                const reader = new FileReader();
                reader.onloadend = function () {
                    users[userIndex].avatar = reader.result;
                    finalizeSave(users, userIndex);
                }
                reader.readAsDataURL(avatarFile);
            } else {
                finalizeSave(users, userIndex);
            }
        }

        function finalizeSave(usersList, idx) {
            localStorage.setItem('users', JSON.stringify(usersList));
            AppState.currentUser.phone = usersList[idx].phone;
            AppState.currentUser.avatar = usersList[idx].avatar;
            AppState.saveToLocalStorage();

            UI.updateUserUI();
            UI.showAlert('Cập nhật hồ sơ thành công!', 'success');
            modal.remove();
        }
    };

    modal.innerHTML = `
        <div style="background: white; border-radius: 4px; padding: 24px; min-width: 450px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 12px; margin-bottom: 20px;">
                <h2 style="font-size: 2rem; color: #333; margin: 0;">Hồ Sơ Của Tôi</h2>
                <button onclick="this.parentElement.parentElement.parentElement.remove()" style="background: none; border: none; font-size: 2.4rem; cursor: pointer; color: #999;">&times;</button>
            </div>
            <div style="display: flex; gap: 20px; align-items: center; margin-bottom: 20px;">
                <img src="${AppState.currentUser.avatar || `https://i.pravatar.cc/150?u=${AppState.currentUser.id}`}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 1px solid #e8e8e8;">
                <div style="font-size: 1.5rem; line-height: 2; flex: 1;">
                    <p style="margin: 0;"><strong>Họ và tên:</strong> ${AppState.currentUser.fullName}</p>
                    <p style="margin: 0;"><strong>Email:</strong> ${AppState.currentUser.email}</p>
                </div>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; font-size: 1.4rem; font-weight: 500; margin-bottom: 5px;">Số điện thoại</label>
                <input type="tel" id="edit-phone-input" value="${AppState.currentUser.phone || ''}" placeholder="Cập nhật số điện thoại" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 1.4rem; box-sizing: border-box;">
            </div>

            <div style="margin-bottom: 25px;">
                <label style="display: block; font-size: 1.4rem; font-weight: 500; margin-bottom: 10px;">Tải Ảnh Đại Diện Lên</label>
                <div style="display: flex; align-items: center; gap: 15px;">
                    <label for="edit-avatar-file" style="padding: 10px 20px; background: #fdfdfd; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 1.4rem; color: #333; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s;">
                        <i class="fa-solid fa-camera"></i> Chọn Ảnh
                    </label>
                    <span id="avatar-file-name" style="font-size: 1.3rem; color: #888;">Chưa chọn tệp nào</span>
                </div>
                <input type="file" id="edit-avatar-file" accept="image/*" style="display: none;" onchange="document.getElementById('avatar-file-name').textContent = this.files.length ? this.files[0].name : 'Chưa chọn tệp nào'">
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; font-size: 1.4rem; font-weight: 500; margin-bottom: 5px;">Mật khẩu mới (Tùy chọn)</label>
                <input type="password" id="edit-pass-input" placeholder="Nhập mật khẩu mới (Tối thiểu 6 ký tự)" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 1.4rem; box-sizing: border-box;">
            </div>
            
            <button onclick="saveUserProfile()" style="width: 100%; padding: 12px; background: #ee4d2b; color: white; border: none; border-radius: 4px; font-size: 1.6rem; font-weight: 500; cursor: pointer; margin-bottom: 12px;">Lưu Thay Đổi</button>
            <div style="display: flex; gap: 10px;">
                <button onclick="this.parentElement.parentElement.parentElement.remove(); showPurchaseModal();" style="flex: 1; padding: 10px; background: #fff; color: #333; border: 1px solid #ddd; border-radius: 4px; font-size: 1.4rem; cursor: pointer;">Xem Đơn Mua</button>
                <button onclick="this.parentElement.parentElement.parentElement.remove(); Auth.logout();" style="flex: 1; padding: 10px; background: #fdfdfd; color: #ee4d2b; border: 1px solid #ee4d2b; border-radius: 4px; font-size: 1.4rem; cursor: pointer;">Đăng Xuất</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

window.showPurchaseModal = function () {
    if (!AppState.currentUser) return;

    // Prepend styling for responsive layout inside Purchase Modal accommodating Mobile views
    const styleId = 'purchaseModalResponsiveStyle';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .purchase-modal-container { width: 90%; max-width: 600px; padding: 24px; }
            .purchase-item-row { display: flex; gap: 15px; border-bottom: 1px solid #eee; padding-bottom: 15px; margin-bottom: 15px; }
            .purchase-item-img { width: 80px; height: 80px; object-fit: cover; border: 1px solid #e8e8e8; }
            .purchase-item-title { margin: 0 0 10px 0; font-size: 1.6rem; color: #333; }
            .purchase-item-price { margin: 0; font-size: 1.5rem; color: #ee4d2d; }
            .purchase-item-total { margin: 5px 0 0 0; font-size: 1.4rem; color: #333; font-weight: 500; }
            .purchase-modal-footer { margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee; text-align: right; }
            
            @media (max-width: 739px) {
                .purchase-modal-container { width: 95%; max-width: 95%; padding: 15px; }
                .purchase-item-row { flex-direction: column; align-items: flex-start; gap: 10px; }
                .purchase-item-img { width: 60px; height: 60px; }
                .purchase-modal-footer { display: flex; justify-content: space-between; align-items: center; text-align: left; }
                .purchase-modal-footer span:first-child { margin-right: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    const modal = document.createElement('div');
    modal.style.cssText = `position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;`;

    // Map strictly from AppState.purchases
    const historyItems = AppState.purchases || [];
    const totalAmount = historyItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    let content = historyItems.length === 0 ?
        `<div style="text-align: center; padding: 40px;"><i class="fa-solid fa-file-invoice" style="font-size: 4rem; color: #ccc; margin-bottom: 10px;"></i><p style="font-size: 1.6rem; color: #777;">Chưa có đơn hàng nào.</p></div>` :
        historyItems.map(item => `
            <div class="purchase-item-row">
                <img src="${item.image}" class="purchase-item-img">
                <div style="flex: 1;">
                    <h4 class="purchase-item-title">${item.name}</h4>
                    <p class="purchase-item-price">₫${item.price.toLocaleString('vi-VN')} <span style="color: #666; font-size: 1.3rem;">x ${item.quantity}</span></p>
                    <p class="purchase-item-total">Thành tiền: ₫${(item.price * item.quantity).toLocaleString('vi-VN')}</p>
                </div>
            </div>
        `).join('');

    modal.innerHTML = `
        <div class="purchase-modal-container" style="background: white; border-radius: 4px; max-height: 80vh; display: flex; flex-direction: column; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 12px; margin-bottom: 20px;">
                <h2 style="font-size: 2rem; color: #333; margin: 0;">Đơn Mua Của Tôi</h2>
                <button onclick="this.parentElement.parentElement.parentElement.remove()" style="background: none; border: none; font-size: 2.4rem; cursor: pointer; color: #999;">&times;</button>
            </div>
            
            <div class="cart-modal-body" style="overflow-y: auto; flex: 1; padding-right: 10px;">
                ${content}
            </div>
            
            ${historyItems.length > 0 ? `
            <div class="purchase-modal-footer">
                <span style="font-size: 1.6rem; color: #333; margin-right: 15px;">Tổng cộng:</span>
                <span style="font-size: 2.2rem; color: #ee4d2d; font-weight: 600;">₫${totalAmount.toLocaleString('vi-VN')}</span>
            </div>
            ` : ''}
        </div>
    `;
    document.body.appendChild(modal);
};

window.showCartModal = function () {
    if (!AppState.currentUser) {
        UI.showAlert('Vui lòng đăng nhập để xem giỏ hàng', 'error');
        return;
    }
    const modal = document.createElement('div');
    modal.style.cssText = `position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;`;

    const cartItems = AppState.cart || [];

    // Prepend styling for responsive layout inside Cart Modal specifically accommodating Mobile views
    const styleId = 'cartModalResponsiveStyle';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .cart-modal-container { width: 90%; max-width: 700px; padding: 24px; }
            .cart-item-row { display: flex; gap: 15px; border-bottom: 1px solid #eee; padding-bottom: 15px; align-items: center; }
            .cart-item-img { width: 80px; height: 80px; object-fit: cover; border: 1px solid #e8e8e8; }
            .cart-item-title { margin: 0 0 10px 0; font-size: 1.4rem; color: #333; }
            .cart-item-price { margin: 0; font-size: 1.5rem; color: #ee4d2d; }
            .cart-qty-control { display: flex; align-items: center; border: 1px solid #ddd; border-radius: 2px; }
            .cart-modal-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #eee; padding-top: 15px; }
            
            @media (max-width: 739px) {
                .cart-modal-container { width: 95%; max-width: 95%; padding: 15px; }
                .cart-item-row { flex-direction: column; align-items: flex-start; gap: 10px; position: relative; }
                .cart-item-img { width: 60px; height: 60px; }
                .cart-item-checkbox { position: absolute; top: 15px; left: 15px; z-index: 2; width: 22px; height: 22px; }
                .cart-modal-footer { flex-direction: column; gap: 15px; align-items: stretch; }
                .cart-modal-footer > div { justify-content: space-between; width: 100%; }
                .cart-checkout-btn { width: 100%; padding: 10px; }
            }
        `;
        document.head.appendChild(style);
    }

    let content = cartItems.length === 0 ?
        `<div style="text-align: center; padding: 40px;"><img src="./assets/img/no-cart.png" style="width: 150px; margin-bottom: 15px;"><p style="font-size: 1.6rem; color: #777;">Giỏ hàng của bạn còn trống.</p></div>` :
        `<div style="display: flex; flex-direction: column; gap: 15px;">
            ${cartItems.map(item => `
                <div class="cart-modal-item cart-item-row">
                    <input type="checkbox" class="cart-item-checkbox" data-id="${item.id}" data-price="${item.price}" onchange="updateCartTotal()" style="width: 18px; height: 18px; cursor: pointer;">
                    <img src="${item.image}" class="cart-item-img">
                    <div style="flex: 1;">
                        <h4 class="cart-item-title">${item.name}</h4>
                        <p class="cart-item-price">₫${item.price.toLocaleString('vi-VN')}</p>
                    </div>
                    <div class="cart-qty-control">
                        <button onclick="CartManager.updateQuantity(${item.id}, ${item.quantity - 1}); document.getElementById('cart-modal-qty-${item.id}').value = ${item.quantity - 1}; updateCartTotal();" style="width: 25px; height: 25px; border: none; background: #fafafa; cursor: pointer;">-</button>
                        <input type="text" id="cart-modal-qty-${item.id}" value="${item.quantity}" readonly style="width: 35px; height: 25px; border: none; border-left: 1px solid #ddd; border-right: 1px solid #ddd; text-align: center; font-size: 1.3rem;">
                        <button onclick="CartManager.updateQuantity(${item.id}, ${item.quantity + 1}); document.getElementById('cart-modal-qty-${item.id}').value = ${item.quantity + 1}; updateCartTotal();" style="width: 25px; height: 25px; border: none; background: #fafafa; cursor: pointer;">+</button>
                    </div>
                </div>
            `).join('')}
        </div>`;

    modal.innerHTML = `
        <div class="cart-modal-container" style="background: white; border-radius: 4px; max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 12px; margin-bottom: 20px;">
                <h2 style="font-size: 2rem; color: #333; margin: 0;">Giỏ Hàng Của Bạn</h2>
                <button onclick="this.parentElement.parentElement.parentElement.remove()" style="background: none; border: none; font-size: 2.4rem; cursor: pointer; color: #999;">&times;</button>
            </div>
            
            <div class="cart-modal-body" style="overflow-y: auto; flex: 1; padding-right: 10px; margin-bottom: 20px;">
                ${content}
            </div>
            
            ${cartItems.length > 0 ? `
            <div class="cart-modal-footer">
                <label style="display: flex; align-items: center; font-size: 1.4rem; cursor: pointer;">
                    <input type="checkbox" id="cart-modal-select-all" onchange="toggleAllCartItems(this)" style="margin-right: 10px; width: 16px; height: 16px;">
                    Chọn Tất Cả (${cartItems.length})
                </label>
                <div style="display: flex; align-items: center; gap: 20px;">
                    <div style="text-align: right;">
                        <span style="font-size: 1.4rem; color: #333;">Tổng thanh toán (0 Sản phẩm):</span>
                        <div style="font-size: 2.2rem; color: #ee4d2d; font-weight: 500;" id="cart-modal-total-price">₫0</div>
                    </div>
                    <button class="cart-checkout-btn" onclick="processCartCheckout()" style="padding: 12px 30px; background: #ee4d2b; color: white; border: none; border-radius: 2px; font-size: 1.4rem; cursor: pointer;">Mua Hàng</button>
                </div>
            </div>
            ` : ''}
        </div>
    `;

    document.body.appendChild(modal);

    window.updateCartTotal = function () {
        const checkboxes = document.querySelectorAll('.cart-item-checkbox');
        let total = 0;
        let count = 0;
        checkboxes.forEach(cb => {
            if (cb.checked) {
                const id = parseInt(cb.getAttribute('data-id'));
                const price = parseFloat(cb.getAttribute('data-price'));
                const qtyInput = document.getElementById(`cart-modal-qty-${id}`);
                const qty = qtyInput ? parseInt(qtyInput.value) : 1;
                total += price * qty;
                count++;
            }
        });

        const totalEl = document.getElementById('cart-modal-total-price');
        const textLabel = totalEl.previousElementSibling;

        if (totalEl) totalEl.textContent = `₫${total.toLocaleString('vi-VN')}`;
        if (textLabel) textLabel.textContent = `Tổng thanh toán (${count} Sản phẩm):`;

        const selectAllCb = document.getElementById('cart-modal-select-all');
        if (selectAllCb) selectAllCb.checked = (count === checkboxes.length && checkboxes.length > 0);
    };

    window.toggleAllCartItems = function (checkboxRef) {
        const checkboxes = document.querySelectorAll('.cart-item-checkbox');
        checkboxes.forEach(cb => cb.checked = checkboxRef.checked);
        updateCartTotal();
    };

    window.processCartCheckout = function () {
        const checkboxes = document.querySelectorAll('.cart-item-checkbox');
        const selectedIds = [];
        checkboxes.forEach(cb => {
            if (cb.checked) selectedIds.push(parseInt(cb.getAttribute('data-id')));
        });

        if (selectedIds.length === 0) {
            UI.showAlert('Vui lòng chọn sản phẩm để thanh toán', 'error');
            return;
        }

        // Apply updated quantities right before checkout
        selectedIds.forEach(id => {
            const qtyInput = document.getElementById(`cart-modal-qty-${id}`);
            if (qtyInput) CartManager.updateQuantity(id, parseInt(qtyInput.value));
        });

        CartManager.checkoutItems(selectedIds);
        modal.remove();
        UI.showAlert('Thanh toán thành công. Vui lòng xem ở Đơn mua', 'success');

        // Re-render native cart dropdown if needed
        UI.updateCartCount();
    };
};
