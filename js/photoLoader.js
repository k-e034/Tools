// js/photoLoader.js - common.jsを使用するように簡素化
document.addEventListener("DOMContentLoaded", function() {
    // URLパラメータからタグを取得
    function getTagFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('tag');
    }

    // タグがない場合は何もしない
    const tag = getTagFromUrl();
    if (!tag) {
        console.log('タグなし - generatePhotoPages.jsで生成されたロール表示を使用');
        return;
    }

    // タグがある場合のみ以下を実行
    console.log(`タグ「${tag}」で写真をフィルタリング中...`);

    // common.jsのTaggedPhotoLoaderを使用
    if (window.taggedPhotoLoader) {
        window.taggedPhotoLoader.filterPhotosByTag(tag);
    } else {
        console.error('TaggedPhotoLoader が見つかりません。common.js が読み込まれているか確認してください。');
    }
});