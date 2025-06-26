const API_BASE_URL = 'http://localhost:3001/api';
let currentData = null;
let currentView = 'executive';

// Utility functions
function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (hours < 1) return 'Just now';
    if (hours === 1) return '1 hour ago';
    if (hours < 24) return `${hours} hours ago`;
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
}

function getPriorityIcon(importance) {
    switch(importance) {
        case 'HIGH': return '🔴';
        case 'MEDIUM': return '🟧';
        case 'LOW': return '🟨';
        default: return '⚪';
    }
}

function formatCategory(category) {
    return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// API functions
async function fetchIntelligence() {
    try {
        const response = await fetch(`${API_BASE_URL}/intelligence`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch intelligence:', error);
        throw error;
    }
}

async function refreshIntelligence() {
    try {
        const response = await fetch(`${API_BASE_URL}/refresh`, {
            method: 'POST'
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        return result.data;
    } catch (error) {
        console.error('Failed to refresh intelligence:', error);
        throw error;
    }
}

// Rendering functions
function createStoryCard(story) {
    const strategicAnalysis = story.strategic_analysis ? `
        <div class="story-strategic">
            <h4>🎯 Strategic Takeaway</h4>
            <p>${story.strategic_analysis.strategic_takeaway}</p>
            
            ${story.strategic_analysis.implications && story.strategic_analysis.implications.length > 0 ? `
                <div class="story-implications">
                    <strong>Key Implications:</strong><br>
                    ${story.strategic_analysis.implications.map(imp => 
                        `<span class="implication-tag">${imp}</span>`
                    ).join('')}
                </div>
            ` : ''}
            
            ${story.strategic_analysis.affected_players && story.strategic_analysis.affected_players.length > 0 ? `
                <div style="margin-top: 0.5rem;">
                    <strong>Affected Players:</strong> ${story.strategic_analysis.affected_players.join(', ')}
                </div>
            ` : ''}
            
            ${story.strategic_analysis.next_moves ? `
                <div style="margin-top: 0.5rem;">
                    <strong>What's Next:</strong> ${story.strategic_analysis.next_moves}
                </div>
            ` : ''}
        </div>
    ` : '';

    return `
        <div class="story-card ${story.importance}">
            <div class="importance ${story.importance.toLowerCase()}">
                ${getPriorityIcon(story.importance)} ${story.importance} PRIORITY
                <span class="score-badge">${story.overall_score}/10</span>
            </div>
            
            <h2 class="story-title">${story.title}</h2>
            
            <div class="story-meta">
                <span class="story-category">${formatCategory(story.category)}</span>
                <span class="story-source">${story.source}</span>
                <span>${formatTimeAgo(story.published)}</span>
            </div>

            ${story.summary && story.summary !== story.title ? `
                <div style="margin: 1rem 0; color: var(--text-secondary); font-size: 0.95rem; line-height: 1.5;">
                    ${story.summary}
                </div>
            ` : ''}

            ${story.reasoning ? `
                <div class="story-analysis">
                    <strong>Why This Matters:</strong><br>
                    ${story.reasoning}
                </div>
            ` : ''}

            ${strategicAnalysis}

            <div style="margin-top: 1rem; display: flex; justify-content: space-between; align-items: center;">
                <div style="font-size: 0.8rem; color: var(--text-secondary);">
                    Impact: ${story.impact_score}/10 • 
                    Timing: ${story.timing_score}/10 • 
                    Players: ${story.players_score}/10
                </div>
                <a href="${story.url}" target="_blank" style="color: var(--accent); text-decoration: none; font-weight: 500;">
                    Read Full Story →
                </a>
            </div>
        </div>
    `;
}

function renderExecutiveView() {
    if (!currentData || !currentData.stories) {
        document.getElementById('storiesGrid').innerHTML = '<p style="color: var(--text-secondary);">No intelligence data available</p>';
        return;
    }

    const grid = document.getElementById('storiesGrid');
    grid.innerHTML = currentData.stories
        .sort((a, b) => {
            const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
            return (priorityOrder[b.importance] - priorityOrder[a.importance]) || 
                   (b.overall_score - a.overall_score);
        })
        .map(createStoryCard)
        .join('');
}

function renderThreadsView() {
    const connectionsDiv = document.getElementById('threadConnections');
    
    if (!currentData || !currentData.connections || currentData.connections.length === 0) {
        connectionsDiv.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                <h3>🔍 Analyzing Strategic Connections...</h3>
                <p>No direct connections identified between current stories.</p>
                <p style="margin-top: 1rem; font-size: 0.9rem;">
                    This could indicate either isolated developments or that our AI analysis 
                    hasn't detected the underlying strategic threads yet.
                </p>
            </div>
        `;
        return;
    }

    let connectionsHTML = '';
    
    currentData.connections.forEach(connection => {
        const story1 = currentData.stories.find(s => s.id == connection.story1_id);
        const story2 = currentData.stories.find(s => s.id == connection.story2_id);
        
        if (story1 && story2) {
            const relationshipIcons = {
                'response_to': '↻',
                'enables': '→',
                'competes_with': '⚡',
                'builds_on': '🏗️'
            };
            
            connectionsHTML += `
                <div class="thread-connection">
                    <div style="flex: 1;">
                        <strong>${story1.title}</strong>
                        <div style="color: var(--text-secondary); font-size: 0.8rem;">
                            ${formatCategory(story1.category)} • ${story1.source}
                        </div>
                    </div>
                    <div class="connection-arrow">
                        ${relationshipIcons[connection.relationship] || '→'}
                        <div style="font-size: 0.7rem; text-transform: uppercase;">
                            ${connection.relationship.replace(/_/g, ' ')}
                        </div>
                    </div>
                    <div style="flex: 1;">
                        <strong>${story2.title}</strong>
                        <div style="color: var(--text-secondary); font-size: 0.8rem;">
                            ${formatCategory(story2.category)} • ${story2.source}
                        </div>
                    </div>
                </div>
                ${connection.explanation ? `
                    <div style="margin: -0.5rem 0 1rem 1rem; padding: 0.5rem; 
                               background: var(--bg-secondary); border-radius: 4px; 
                               font-size: 0.85rem; color: var(--text-secondary);">
                        💡 ${connection.explanation}
                    </div>
                ` : ''}
            `;
        }
    });

    connectionsDiv.innerHTML = connectionsHTML;
}

function renderAnalysisView() {
    const analysisDiv = document.getElementById('analysisContent');
    
    let analysisHTML = '';

    // Power shifts analysis
    if (currentData && currentData.power_shifts) {
        analysisHTML += `
            <div class="trend-card" style="margin-bottom: 2rem;">
                <h3 style="color: var(--high); margin-bottom: 1rem;">⚡ Power Dynamics</h3>
                <p style="line-height: 1.6;">${currentData.power_shifts}</p>
            </div>
        `;
    }

    // Trends analysis
    if (currentData && currentData.trends && currentData.trends.length > 0) {
        analysisHTML += `
            <div style="margin-bottom: 2rem;">
                <h3 style="color: var(--accent); margin-bottom: 1rem;">📈 Emerging Trends</h3>
                <div class="trends-grid">
                    ${currentData.trends.map((trend, index) => `
                        <div class="trend-card">
                            <div class="trend-title">Trend #${index + 1}</div>
                            <p>${trend}</p>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Category breakdown
    if (currentData && currentData.stories) {
        const categoryStats = {};
        currentData.stories.forEach(story => {
            categoryStats[story.category] = (categoryStats[story.category] || 0) + 1;
        });

        analysisHTML += `
            <div class="trend-card">
                <h3 style="color: var(--medium); margin-bottom: 1rem;">📊 Intelligence Breakdown</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                    ${Object.entries(categoryStats).map(([category, count]) => `
                        <div style="text-align: center; padding: 1rem; background: var(--primary); border-radius: 6px;">
                            <div style="font-size: 1.5rem; font-weight: bold; color: var(--accent);">${count}</div>
                            <div style="font-size: 0.85rem; color: var(--text-secondary); text-transform: capitalize;">
                                ${formatCategory(category)}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    if (!analysisHTML) {
        analysisHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                <h3>📊 Analysis Processing...</h3>
                <p>Strategic analysis will appear here once sufficient intelligence is gathered.</p>
            </div>
        `;
    }

    analysisDiv.innerHTML = analysisHTML;
}

// Navigation
function switchView(view) {
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    // Hide all views
    document.getElementById('executiveView').style.display = 'none';
    document.getElementById('threadsView').style.display = 'none';
    document.getElementById('analysisView').style.display = 'none';

    // Show selected view
    currentView = view;
    switch(view) {
        case 'executive':
            document.getElementById('executiveView').style.display = 'block';
            renderExecutiveView();
            break;
        case 'threads':
            document.getElementById('threadsView').style.display = 'block';
            renderThreadsView();
            break;
        case 'analysis':
            document.getElementById('analysisView').style.display = 'block';
            renderAnalysisView();
            break;
    }
}

// Data loading
async function loadData() {
    try {
        showLoading();
        const data = await fetchIntelligence();
        currentData = data;
        hideLoading();
        updateLastUpdated();
        renderCurrentView();
    } catch (error) {
        hideLoading();
        showError(error.message);
    }
}

async function refreshData() {
    const refreshBtn = document.getElementById('refreshBtn');
    const originalText = refreshBtn.innerHTML;
    
    try {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '⟳ Refreshing...';
        
        const data = await refreshIntelligence();
        currentData = data;
        updateLastUpdated();
        renderCurrentView();
        
        // Show success briefly
        refreshBtn.innerHTML = '✓ Updated';
        setTimeout(() => {
            refreshBtn.innerHTML = originalText;
            refreshBtn.disabled = false;
        }, 2000);
    } catch (error) {
        refreshBtn.innerHTML = originalText;
        refreshBtn.disabled = false;
        showError(`Refresh failed: ${error.message}`);
    }
}

function renderCurrentView() {
    switch(currentView) {
        case 'executive':
            renderExecutiveView();
            break;
        case 'threads':
            renderThreadsView();
            break;
        case 'analysis':
            renderAnalysisView();
            break;
    }
}

// UI state management
function showLoading() {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('content').style.display = 'none';
    document.getElementById('error').style.display = 'none';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'block';
}

function showError(message) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'none';
    document.getElementById('error').style.display = 'block';
    document.getElementById('errorMessage').textContent = message;
}

function updateLastUpdated() {
    const lastUpdatedEl = document.getElementById('lastUpdated');
    if (currentData && currentData.lastUpdated) {
        const date = new Date(currentData.lastUpdated);
        lastUpdatedEl.textContent = `Last updated: ${date.toLocaleTimeString()}`;
    } else {
        lastUpdatedEl.textContent = 'Last updated: Unknown';
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadData();
});

// Auto-refresh every 10 minutes
setInterval(() => {
    if (currentData) {
        loadData();
    }
}, 10 * 60 * 1000);