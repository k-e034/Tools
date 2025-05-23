// js/common.js - 共通写真管理機能
// photoDetail.js と photoLoader.js の機能を統合

class PhotoDataManager {
    constructor() {
        this.photos = null;
        this.photosById = null;
    }
    
    async loadPhotos() {
        if (this.photos) return this.photos;
        
        try {
            const response = await fetch('data/photos.json');
            if (!response.ok) {
                throw new Error('写真データの読み込みに失敗しました');
            }
            const data = await response.json();
            this.photos = Array.isArray(data) ? data : data.photos;
            
            // ID索引を作成
            this.photosById = {};
            this.photos.forEach(photo => {
                this.photosById[photo.id] = photo;
            });
            
            return this.photos;
        } catch (error) {
            console.error('Error loading photo data:', error);
            return [];
        }
    }
    
    async getPhotoById(id) {
        await this.loadPhotos();
        return this.photosById[parseInt(id)];
    }
    
    async filterByTag(tag) {
        const photos = await this.loadPhotos();
        return photos.filter(photo => 
            photo.tags && photo.tags.includes(tag)
        );
    }
    
    async filterByTags(tags) {
        if (!tags || tags.length === 0) return [];
        
        const photos = await this.loadPhotos();
        return photos.filter(photo => 
            photo.tags && tags.some(tag => photo.tags.includes(tag))
        );
    }
    
    createPhotoCard(photo) {
        const photoCard = document.createElement('div');
        photoCard.className = 'feature-card';
        photoCard.innerHTML = `
            <a href="${photo.page}">
                <div class="feature-image" style="background-image: url('${photo.image}');"></div>
                <div class="feature-content">
                    <div class="post-date">${photo.dateDisplay || ''}</div>
                    <h3>${photo.title}</h3>
                </div>
            </a>
        `;
        return photoCard;
    }
}

// 写真詳細ページ用の機能
class PhotoDetailManager {
    constructor() {
        this.photoManager = new PhotoDataManager();
    }
    
    getPhotoIdFromUrl() {
        const path = window.location.pathname;
        const filename = path.substring(path.lastIndexOf('/') + 1);
        
        // photo1.html から 1 を抽出
        const matches = filename.match(/photo(\d+)\.html/);
        if (matches && matches.length > 1) {
            return parseInt(matches[1]);
        }
        return null;
    }
    
    async displayRelatedPhotos(currentPhoto) {
        const relatedContainer = document.getElementById('related-photos-container');
        if (!relatedContainer) return;
        
        const allPhotos = await this.photoManager.loadPhotos();
        
        // 同じタグを持つ写真を関連写真として表示（現在の写真を除く）
        const relatedPhotos = allPhotos.filter(photo => 
            photo.id !== currentPhoto.id && 
            photo.tags && currentPhoto.tags &&
            photo.tags.some(tag => currentPhoto.tags.includes(tag))
        ).slice(0, 3); // 最大3枚
        
        relatedContainer.innerHTML = '';
        
        if (relatedPhotos.length === 0) {
            relatedContainer.innerHTML = '<p>関連写真はありません</p>';
            return;
        }
        
        relatedPhotos.forEach(photo => {
            const photoCard = document.createElement('div');
            photoCard.className = 'related-photo-card';
            
            photoCard.innerHTML = `
                <a href="${photo.page}">
                    <div class="related-photo-image" style="background-image: url('${photo.image}');"></div>
                    <h3>${photo.title}</h3>
                </a>
            `;
            
            relatedContainer.appendChild(photoCard);
        });
    }
    
    async init() {
        const photoId = this.getPhotoIdFromUrl();
        if (!photoId) {
            console.error('写真IDが見つかりません');
            return;
        }
        
        const currentPhoto = await this.photoManager.getPhotoById(photoId);
        
        if (!currentPhoto) {
            console.error('指定されたIDの写真が見つかりません:', photoId);
            return;
        }
        
        // 関連写真を表示
        await this.displayRelatedPhotos(currentPhoto);
    }
}

// タグページ用の機能
class TaggedPhotoLoader {
    constructor() {
        this.photoManager = new PhotoDataManager();
    }
    
    getTagFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('tag');
    }
    
    async filterPhotosByTag(tag) {
        if (!tag) {
            console.log('タグなし - ロール表示を使用');
            return;
        }
        
        console.log(`タグ「${tag}」で写真をフィルタリング中...`);
        
        const filteredPhotos = await this.photoManager.filterByTag(tag);
        const photoGrid = document.getElementById('photo-grid');
        
        if (!photoGrid) return;
        
        // タグフィルタ時は従来の個別写真表示に変更
        photoGrid.className = 'feature-grid';
        photoGrid.innerHTML = '';
        
        // ページタイトルを更新
        const mainContent = document.querySelector('.main-content');
        let title = mainContent.querySelector('h2');
        if (!title) {
            title = document.createElement('h2');
            title.className = 'section-title';
            mainContent.insertBefore(title, photoGrid);
        }
        title.textContent = `タグ「${tag}」の写真`;

        if (filteredPhotos.length === 0) {
            const noPhotos = document.createElement('p');
            noPhotos.textContent = 'タグに一致する写真はありません';
            noPhotos.className = 'no-photos-message';
            noPhotos.style.textAlign = 'center';
            noPhotos.style.color = '#aaa';
            noPhotos.style.margin = '2rem 0';
            photoGrid.appendChild(noPhotos);
            
            const loadMoreBtn = document.getElementById('load-more');
            if (loadMoreBtn) loadMoreBtn.style.display = 'none';
        } else {
            // 最初の9枚のみ表示
            this.displayPhotos(filteredPhotos.slice(0, 9), photoGrid);
            this.setupLoadMore(filteredPhotos);
        }
        
        // 「ロール一覧に戻る」リンクを追加
        this.addBackToRollsLink(mainContent);
    }
    
    displayPhotos(photos, container) {
        photos.forEach(photo => {
            const photoCard = this.photoManager.createPhotoCard(photo);
            container.appendChild(photoCard);
        });
    }
    
    setupLoadMore(allPhotos) {
        const loadMoreBtn = document.getElementById('load-more');
        if (!loadMoreBtn) return;
        
        if (allPhotos.length <= 9) {
            loadMoreBtn.style.display = 'none';
        } else {
            loadMoreBtn.style.display = 'block';
            loadMoreBtn.onclick = () => {
                const photoGrid = document.getElementById('photo-grid');
                const currentCount = photoGrid.children.length;
                const nextBatch = allPhotos.slice(currentCount, currentCount + 9);
                
                this.displayPhotos(nextBatch, photoGrid);
                
                if (currentCount + nextBatch.length >= allPhotos.length) {
                    loadMoreBtn.style.display = 'none';
                    const message = document.createElement('p');
                    message.textContent = 'すべての写真を表示しました';
                    message.className = 'all-loaded-message';
                    loadMoreBtn.parentNode.appendChild(message);
                }
            };
        }
    }
    
    addBackToRollsLink(mainContent) {
        const backToRolls = document.createElement('div');
        backToRolls.style.textAlign = 'center';
        backToRolls.style.margin = '2rem 0';
        backToRolls.innerHTML = `<a href="index.html" class="btn">ロール一覧に戻る</a>`;
        mainContent.insertBefore(backToRolls, mainContent.firstChild);
    }
    
    async init() {
        const tag = this.getTagFromUrl();
        if (tag) {
            await this.filterPhotosByTag(tag);
        }
    }
}

// グローバルインスタンス
window.photoManager = new PhotoDataManager();
window.photoDetailManager = new PhotoDetailManager();
window.taggedPhotoLoader = new TaggedPhotoLoader();

// 自動初期化（ページの種類に応じて）
document.addEventListener("DOMContentLoaded", function() {
    // 写真詳細ページの場合
    if (window.location.pathname.includes('photo') && window.location.pathname.includes('.html')) {
        window.photoDetailManager.init();
    }
    
    // タグページの場合
    if (window.location.search.includes('tag=')) {
        window.taggedPhotoLoader.init();
    }
});