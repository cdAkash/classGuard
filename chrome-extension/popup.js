document.addEventListener('DOMContentLoaded', function() {
  const statusDot = document.getElementById('status-dot');
  const statusLabel = document.getElementById('status-label');
  const imageGallery = document.getElementById('image-gallery');
  const attentionScoreDiv = document.getElementById('attention-score');

  // Function to update status
  function updateStatus(isActive, message) {
    if (isActive) {
      statusDot.classList.add('active');
      statusDot.classList.remove('inactive');
    } else {
      statusDot.classList.add('inactive');
      statusDot.classList.remove('active');
    }
    statusLabel.textContent = message;
  }

  // Helper to color code the score
  function colorForScore(score) {
    if (score > 65) return 'green';
    if (score >= 40) return 'orange';
    return 'red';
  }

  // Fetch the user's email from background
  function getUserEmail(callback) {
    chrome.runtime.sendMessage({action: "getEmail"}, function(response) {
      if (response && response.email) {
        callback(response.email);
      } else {
        callback(null);
      }
    });
  }

  // Extract meeting ID from the active Meet tab's URL
  function getMeetingIdFromTab(tab) {
    try {
      const url = new URL(tab.url);
      // Google Meet URLs are like https://meet.google.com/abc-defg-hij
      const parts = url.pathname.split('/');
      return parts[1] || null;
    } catch {
      return null;
    }
  }

  // Fetch and display attention score
  function fetchAndDisplayAttentionScore(meetingId, userEmail) {
    if (!meetingId || !userEmail) {
      attentionScoreDiv.textContent = 'Attention Score: ';
      attentionScoreDiv.style.color = 'gray';
      return;
    }
    const apiUrl = `https://classguard.onrender.com/api/db-attention-score?meeting_id=${encodeURIComponent(meetingId)}&user_email=${encodeURIComponent(userEmail)}`;
    fetch(apiUrl)
      .then(resp => resp.json())
      .then(data => {
        const score = data.attention_percent || 0;
        attentionScoreDiv.textContent = `Attention Score: ${score.toFixed(2)}%`;
        attentionScoreDiv.style.color = colorForScore(score);
      })
      .catch(() => {
        attentionScoreDiv.textContent = 'Attention Score: ';
        attentionScoreDiv.style.color = 'gray';
      });
  }

  // Main logic: find Meet tab, get email, poll score
  function updateAttentionScore() {
    chrome.tabs.query({}, function(tabs) {
      const meetTab = tabs.find(tab => 
        tab.url && tab.url.includes('meet.google.com') && tab.active
      );
      if (meetTab) {
        const meetingId = getMeetingIdFromTab(meetTab);
        getUserEmail(function(email) {
          fetchAndDisplayAttentionScore(meetingId, email);
        });
      } else {
        attentionScoreDiv.textContent = 'Attention Score: ';
        attentionScoreDiv.style.color = 'gray';
      }
    });
  }

  // Initial call and polling
  updateAttentionScore();
  setInterval(updateAttentionScore, 5000);

  // Check if there's an active Google Meet tab
  chrome.tabs.query({}, function(tabs) {
    const meetTab = tabs.find(tab => 
      tab.url && tab.url.includes('meet.google.com') && tab.active
    );

    if (meetTab) {
      console.log('Found active Meet tab:', meetTab.id);
      
      // Execute script to check if user is in a meeting
      chrome.scripting.executeScript({
        target: { tabId: meetTab.id },
        function: checkMeetingStatus
      }, (results) => {
        if (results && results[0] && results[0].result) {
          console.log('User is in a meeting');
          updateStatus(true, 'Active - Sending images to server');
          imageGallery.innerHTML = '<p>Images are being sent to the server</p>';
        } else {
          console.log('User is not in a meeting');
          updateStatus(false, 'Inactive - Not in meeting');
          imageGallery.innerHTML = '<p>Join a meeting to start capturing</p>';
        }
      });
    } else {
      console.log('No active Meet tab found');
      updateStatus(false, 'Inactive - No Meet tab');
      imageGallery.innerHTML = '<p>Open Google Meet to start</p>';
    }
  });
});

// Function to check if user is in a meeting
function checkMeetingStatus() {
  const isInMeeting = 
    document.querySelector('[data-is-muted]') !== null ||
    document.querySelector('[data-allocation-index]') !== null ||
    document.querySelector('[data-participant-id]') !== null ||
    document.querySelector('[data-tooltip-id="tt-m0"]') !== null;

  return isInMeeting;
} 