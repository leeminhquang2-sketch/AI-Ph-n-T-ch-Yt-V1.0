// ============================================
// HÀM PHÂN TÍCH CHÍNH
// ============================================

async function analyzeChannel() {
    const apiKey = document.getElementById('apiKey').value.trim();
    const channelId = document.getElementById('channelId').value.trim();
    
    // Validate
    if (!apiKey || !channelId) {
        alert('⚠️ Vui lòng nhập đầy đủ API Key và Channel ID!');
        return;
    }
    
    // UI Loading
    const btn = document.getElementById('analyzeBtn');
    const btnText = document.getElementById('btnText');
    const spinner = document.getElementById('btnSpinner');
    btn.disabled = true;
    btnText.textContent = 'Đang phân tích...';
    spinner.style.display = 'block';
    
    try {
        // 1. Lấy thông tin kênh
        const channelInfo = await getChannelInfo(apiKey, channelId);
        if (!channelInfo) {
            throw new Error('Không tìm thấy kênh! Vui lòng kiểm tra Channel ID.');
        }
        
        // 2. Lấy danh sách video
        const videos = await getVideos(apiKey, channelId, 20);
        
        // 3. Phân tích dữ liệu
        const analysis = analyzeData(channelInfo, videos);
        
        // 4. Hiển thị kết quả
        displayResults(channelInfo, videos, analysis);
        
    } catch (error) {
        alert('❌ Lỗi: ' + error.message);
        console.error(error);
    } finally {
        btn.disabled = false;
        btnText.textContent = '🚀 Phân tích ngay';
        spinner.style.display = 'none';
    }
}

// ============================================
// GỌI YOUTUBE API
// ============================================

async function getChannelInfo(apiKey, channelId) {
    const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${channelId}&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.error) {
        throw new Error(data.error.message);
    }
    
    if (!data.items || data.items.length === 0) {
        return null;
    }
    
    const item = data.items[0];
    return {
        id: item.id,
        name: item.snippet.title,
        avatar: item.snippet.thumbnails.default.url,
        subscribers: parseInt(item.statistics.subscriberCount),
        totalViews: parseInt(item.statistics.viewCount),
        totalVideos: parseInt(item.statistics.videoCount),
        createdDate: item.snippet.publishedAt.substring(0, 10)
    };
}

async function getVideos(apiKey, channelId, maxResults = 20) {
    // Lấy danh sách video ID
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?channelId=${channelId}&part=id&order=date&maxResults=${maxResults}&key=${apiKey}`;
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();
    
    if (searchData.error) {
        throw new Error(searchData.error.message);
    }
    
    const videoIds = searchData.items
        .filter(item => item.id.videoId)
        .map(item => item.id.videoId);
    
    if (videoIds.length === 0) return [];
    
    // Lấy chi tiết video
    const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds.join(',')}&key=${apiKey}`;
    const videoResponse = await fetch(videoUrl);
    const videoData = await videoResponse.json();
    
    if (videoData.error) {
        throw new Error(videoData.error.message);
    }
    
    return videoData.items.map(item => ({
        title: item.snippet.title,
        views: parseInt(item.statistics.viewCount || 0),
        likes: parseInt(item.statistics.likeCount || 0),
        comments: parseInt(item.statistics.commentCount || 0),
        publishedAt: item.snippet.publishedAt.substring(0, 10)
    }));
}

// ============================================
// HÀM PHÂN TÍCH DỮ LIỆU (AI LOGIC)
// ============================================

function analyzeData(channelInfo, videos) {
    const { subscribers, totalViews, totalVideos, createdDate } = channelInfo;
    
    // Tính tuổi kênh (ngày)
    const created = new Date(createdDate);
    const now = new Date();
    const daysOld = Math.floor((now - created) / (1000 * 60 * 60 * 24));
    const monthsOld = Math.floor(daysOld / 30);
    
    // Tỷ lệ view/sub
    const viewPerSub = totalViews / subscribers;
    const viewPerVideo = totalViews / totalVideos;
    
    // Phân tích video gần đây
    let avgViews = 0, avgLikes = 0, avgComments = 0, engagementRate = 0;
    let growthRate = 0;
    
    if (videos.length > 0) {
        avgViews = videos.reduce((sum, v) => sum + v.views, 0) / videos.length;
        avgLikes = videos.reduce((sum, v) => sum + v.likes, 0) / videos.length;
        avgComments = videos.reduce((sum, v) => sum + v.comments, 0) / videos.length;
        
        const totalEngagement = avgLikes + avgComments;
        engagementRate = (totalEngagement / avgViews) * 100;
        
        // Tốc độ tăng trưởng (so sánh video cũ vs mới)
        const mid = Math.floor(videos.length / 2);
        if (mid > 0) {
            const oldAvg = videos.slice(0, mid).reduce((sum, v) => sum + v.views, 0) / mid;
            const newAvg = videos.slice(mid).reduce((sum, v) => sum + v.views, 0) / (videos.length - mid);
            growthRate = ((newAvg - oldAvg) / oldAvg) * 100;
        }
    }
    
    // ============================================
    // TÍNH ĐIỂM SỨC KHỎE (0-10)
    // ============================================
    let score = 0;
    const feedback = [];
    const improvements = [];
    
    // Tiêu chí 1: Subscriber
    if (subscribers > 100000) { score += 2; feedback.push('✅ Kênh lớn (100K+ subscribers)'); }
    else if (subscribers > 10000) { score += 1.5; feedback.push('✅ Kênh tầm trung (10K+ subscribers)'); }
    else if (subscribers > 1000) { score += 1; feedback.push('📈 Kênh đang phát triển (1K+ subscribers)'); }
    else { feedback.push('🌱 Kênh mới bắt đầu (dưới 1K subscribers)'); }
    
    // Tiêu chí 2: Tỷ lệ view/sub
    if (viewPerSub > 5) { score += 2; feedback.push(`🔥 Tỷ lệ view/sub rất tốt: ${viewPerSub.toFixed(1)}`); }
    else if (viewPerSub > 2) { score += 1.5; feedback.push(`👍 Tỷ lệ view/sub tốt: ${viewPerSub.toFixed(1)}`); }
    else if (viewPerSub > 0.8) { score += 1; feedback.push(`📊 Tỷ lệ view/sub trung bình: ${viewPerSub.toFixed(1)}`); }
    else { feedback.push(`⚠️ Tỷ lệ view/sub thấp: ${viewPerSub.toFixed(1)} (cần cải thiện)`); improvements.push('Tăng tỷ lệ view/sub bằng cách tạo nội dung thu hút hơn'); }
    
    // Tiêu chí 3: Tương tác (Engagement)
    if (engagementRate > 5) { score += 2; feedback.push(`💬 Tương tác rất tốt: ${engagementRate.toFixed(1)}%`); }
    else if (engagementRate > 2.5) { score += 1.5; feedback.push(`💬 Tương tác tốt: ${engagementRate.toFixed(1)}%`); }
    else if (engagementRate > 1) { score += 0.5; feedback.push(`💬 Tương tác trung bình: ${engagementRate.toFixed(1)}%`); }
    else { feedback.push(`⚠️ Tương tác thấp: ${engagementRate.toFixed(1)}%`); improvements.push('Kêu gọi người xem like, comment, share nhiều hơn'); }
    
    // Tiêu chí 4: Tăng trưởng
    if (growthRate > 30) { score += 2; feedback.push(`🚀 Tăng trưởng cực tốt: ${growthRate.toFixed(1)}%`); }
    else if (growthRate > 10) { score += 1.5; feedback.push(`📈 Tăng trưởng tốt: ${growthRate.toFixed(1)}%`); }
    else if (growthRate > -5) { score += 0.5; feedback.push(`📊 Tăng trưởng ổn định: ${growthRate.toFixed(1)}%`); }
    else { feedback.push(`⚠️ Tăng trưởng âm: ${growthRate.toFixed(1)}%`); improvements.push('Cần đổi mới nội dung, thử trend mới'); }
    
    // Tiêu chí 5: Tuổi kênh
    if (monthsOld > 12) { score += 1; feedback.push(`📆 Kênh lâu năm (${monthsOld} tháng)`); }
    else if (monthsOld > 3) { score += 0.5; feedback.push(`📆 Kênh trẻ (${monthsOld} tháng)`); }
    else { feedback.push(`🌱 Kênh mới (${monthsOld} tháng)`); improvements.push('Chăm chỉ đăng video đều đặn để xây dựng khán giả'); }
    
    // Ước lượng tỷ lệ đề xuất (dựa trên engagement và growth)
    let suggestedRate = 30 + (engagementRate * 3) + (growthRate * 0.2);
    suggestedRate = Math.min(Math.max(suggestedRate, 5), 80); // Giới hạn 5-80%
    
    // Đảm bảo score không vượt quá 10
    score = Math.min(score, 10);
    
    return {
        score: Math.round(score * 10) / 10,
        viewPerSub: viewPerSub,
        engagementRate: engagementRate,
        growthRate: growthRate,
        suggestedRate: Math.round(suggestedRate),
        feedback: feedback,
        improvements: improvements,
        avgViews: Math.round(avgViews),
        monthsOld: monthsOld
    };
}

// ============================================
// HIỂN THỊ KẾT QUẢ
// ============================================

function displayResults(channelInfo, videos, analysis) {
    const resultDiv = document.getElementById('result');
    resultDiv.style.display = 'block';
    
    // Scroll đến kết quả
    resultDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    // Thông tin kênh
    document.getElementById('avatar').src = channelInfo.avatar;
    document.getElementById('channelName').textContent = channelInfo.name;
    document.getElementById('channelStats').textContent = 
        `📅 Hoạt động từ ${channelInfo.createdDate} · 🎬 ${channelInfo.totalVideos} video`;
    
    // Thông số
    document.getElementById('subCount').textContent = formatNumber(channelInfo.subscribers);
    document.getElementById('viewCount').textContent = formatNumber(channelInfo.totalViews);
    document.getElementById('videoCount').textContent = formatNumber(channelInfo.totalVideos);
    document.getElementById('createdDate').textContent = channelInfo.createdDate;
    
    // Điểm số
    document.getElementById('scoreNumber').textContent = analysis.score;
    const scoreLabel = document.getElementById('scoreLabel');
    const scoreDesc = document.getElementById('scoreDesc');
    
    if (analysis.score >= 8) {
        scoreLabel.textContent = '🌟 Kênh xuất sắc!';
        scoreDesc.textContent = 'Nội dung chất lượng, thuật toán yêu thích';
        document.querySelector('.score-circle').style.color = '#4CAF50';
    } else if (analysis.score >= 6) {
        scoreLabel.textContent = '👍 Kênh tốt';
        scoreDesc.textContent = 'Đang đi đúng hướng, tiếp tục phát huy';
        document.querySelector('.score-circle').style.color = '#FFA500';
    } else if (analysis.score >= 4) {
        scoreLabel.textContent = '📊 Kênh trung bình';
        scoreDesc.textContent = 'Cần cải thiện một số điểm yếu';
        document.querySelector('.score-circle').style.color = '#FF6B6B';
    } else {
        scoreLabel.textContent = '⚠️ Kênh yếu';
        scoreDesc.textContent = 'Cần thay đổi chiến lược nội dung';
        document.querySelector('.score-circle').style.color = '#FF0000';
    }
    
    // Tỷ lệ đề xuất
    document.getElementById('suggestedBar').style.width = analysis.suggestedRate + '%';
    document.getElementById('suggestedText').textContent = 
        `📊 Ước tính ${analysis.suggestedRate}% tổng lượt xem đến từ đề xuất của YouTube ` +
        (analysis.suggestedRate >= 50 ? '🔥 (Rất tốt!)' : analysis.suggestedRate >= 35 ? '👍 (Khá tốt)' : '📊 (Cần cải thiện)');
    
    // Feedback
    const feedbackList = document.getElementById('feedbackList');
    feedbackList.innerHTML = '';
    analysis.feedback.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        feedbackList.appendChild(li);
    });
    
    // Đề xuất cải thiện
    const improveList = document.getElementById('improveList');
    improveList.innerHTML = '';
    if (analysis.improvements.length === 0) {
        const li = document.createElement('li');
        li.textContent = '✅ Kênh đang hoạt động rất tốt, không có đề xuất cải thiện đáng kể!';
        improveList.appendChild(li);
    } else {
        analysis.improvements.forEach(item => {
            const li = document.createElement('li');
            li.textContent = '💡 ' + item;
            improveList.appendChild(li);
        });
    }
}

// ============================================
// HÀM TIỆN ÍCH
// ============================================

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

// Cho phép nhấn Enter để submit
document.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        const active = document.activeElement;
        if (active.id === 'apiKey' || active.id === 'channelId') {
            analyzeChannel();
        }
    }
});
