// Global state
let currentStoryId = null;
const API_BASE_URL = '';

// DOM Elements
const storyDisplay = document.getElementById('story-display');
const storyInput = document.getElementById('story-input');
const addSegmentButton = document.getElementById('add-segment-button');

const storyListDiv = document.getElementById('story-list');
const newStoryTitleInput = document.getElementById('new-story-title');
const createStoryButton = document.getElementById('create-story-button');
const currentStoryTitleH3 = document.getElementById('current-story-title');


// Helper function to update UI when no story is selected
function setNoStorySelectedUI() {
    currentStoryId = null;
    currentStoryTitleH3.textContent = 'Select or create a story.';
    storyDisplay.innerHTML = '<p>Select a story to view its content.</p>';
    addSegmentButton.disabled = true;
    // Remove 'selected-story' class from all items
    document.querySelectorAll('.story-item').forEach(item => item.classList.remove('selected-story'));
}

// Helper function to update UI when a story is selected
function setStorySelectedUI(storyId, storyTitle) {
    currentStoryId = storyId;
    currentStoryTitleH3.textContent = storyTitle;
    addSegmentButton.disabled = false;
    storyInput.value = ''; // Clear input when switching stories

    // Update selected class
    document.querySelectorAll('.story-item').forEach(item => {
        if (item.getAttribute('data-story-id') === String(storyId)) {
            item.classList.add('selected-story');
        } else {
            item.classList.remove('selected-story');
        }
    });
}

// Function to fetch and display all stories
async function fetchAndDisplayStories() {
  storyListDiv.innerHTML = 'Loading stories...';
  try {
    const response = await fetch('/stories');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const stories = await response.json();
    storyListDiv.innerHTML = ''; // Clear loading message

    if (stories.length === 0) {
      storyListDiv.innerHTML = '<p>No stories yet. Create one!</p>';
      setNoStorySelectedUI(); // Ensure UI reflects no story selected
      return;
    }

stories.forEach(story => {
  const storyElement = document.createElement('div');
  storyElement.classList.add('story-item');

  const storyLink = document.createElement('a');
  storyLink.href = '#';
  storyLink.textContent = story.title;
  storyLink.onclick = async (e) => {
    e.preventDefault();
    setStorySelectedUI(story.id, story.title);
    await fetchAndDisplaySegments(story.id);
  };

  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = 'Delete';
  deleteBtn.onclick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await deleteStory(story.id);
  };

  storyElement.appendChild(storyLink);
  storyElement.appendChild(deleteBtn);
  storyListDiv.appendChild(storyElement);
});
  } catch (error) {
    console.error('Error fetching stories:', error);
    storyListDiv.innerHTML = '<p style="color: red;">Error loading stories.</p>';
    setNoStorySelectedUI();
  }
}

// Function to fetch and display segments for a given story ID
// Function to fetch and display segments for a given story ID
async function fetchAndDisplaySegments(storyId) {
  if (!storyId) { 
    setNoStorySelectedUI();
    return;
  }

  storyDisplay.innerHTML = '<p>Loading segments...</p>';
  try {
    const response = await fetch(`${API_BASE_URL}/stories/${storyId}/segments`);
    const segments = await response.json();

    storyDisplay.innerHTML = ''; 

    if (!Array.isArray(segments)) {
      throw new Error(`Unexpected response: ${JSON.stringify(segments)}`);
    }

    if (segments.length === 0) {
      storyDisplay.innerHTML = '<p>This story is empty. Be the first to contribute!</p>';
    } else {
      segments.forEach(segment => {
        const p = document.createElement('p');
        p.textContent = segment.text;
        storyDisplay.appendChild(p);
      });
    }
  } catch (error) {
    console.error('Error fetching segments:', error);
    storyDisplay.innerHTML = `<p style="color: red;">Error loading segments. ${error.message}</p>`;
  }
}

    // Don't disable addSegmentButton here, as the story is still selected, just segments failed to load

// Event Listener for Create Story Button
createStoryButton.addEventListener('click', async () => {
  const newTitle = newStoryTitleInput.value.trim();
  if (newTitle === '') {
    alert('Please enter a title for the new story.');
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/stories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(`HTTP error! status: ${response.status} - ${errorData ? errorData.error : 'Unknown error'}`);
    }
    
    const newStory = await response.json();
    newStoryTitleInput.value = '';
    
    await fetchAndDisplayStories(); // Refresh the story list
    
    // Auto-select the newly created story
    const newStoryElement = storyListDiv.querySelector(`.story-item[data-story-id="${newStory.id}"]`);
    if (newStoryElement) {
      // newStoryElement.click(); // Programmatically click
      // Or, directly call selection logic:
      setStorySelectedUI(newStory.id, newStory.title);
      await fetchAndDisplaySegments(newStory.id);
    } else {
      // Fallback if element not found immediately (should be rare if fetchAndDisplayStories is awaited)
      setStorySelectedUI(newStory.id, newStory.title);
      await fetchAndDisplaySegments(newStory.id);
    }

  } catch (error) {
    console.error('Error creating story:', error);
    alert(`Failed to create story: ${error.message}`);
  }
});

// Event Listener for Add Segment Button
addSegmentButton.addEventListener('click', async () => {
  if (!currentStoryId) {
    alert('Please select a story first!');
    return;
  }

  const segmentText = storyInput.value.trim();
  if (segmentText === '') {
    alert('Please enter some text for your story segment.');
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/stories/${currentStoryId}/segments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: segmentText }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(`HTTP error! status: ${response.status} - ${errorData ? errorData.error : 'Unknown error'}`);
    }
    
    storyInput.value = '';
    await fetchAndDisplaySegments(currentStoryId);

  } catch (error) {
    console.error('Error adding segment:', error);
    alert(`Failed to add segment: ${error.message}`);
  }
});

// New delete functions explicitly added below:

async function deleteStory(storyId) {
  if (!confirm("Are you sure you want to delete this story and all its segments?")) return;

  try {
    const response = await fetch(`${API_BASE_URL}/stories/${storyId}`, {
      method: 'DELETE',
    });

    if (!response.ok) throw new Error('Failed to delete story.');
    alert('Story deleted successfully.');
    await fetchAndDisplayStories();
    setNoStorySelectedUI();
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
}

async function deleteSegment(storyId, segmentId) {
  if (!confirm("Are you sure you want to delete this segment?")) return;

  try {
    const response = await fetch(`${API_BASE_URL}/stories/${storyId}/segments/${segmentId}`, {
      method: 'DELETE',
    });

    if (!response.ok) throw new Error('Failed to delete segment.');
    alert('Segment deleted successfully.');
    await fetchAndDisplaySegments(storyId);
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
}

// Initial Load
function initializeApp() {
  setNoStorySelectedUI(); // Set initial UI state
  fetchAndDisplayStories();
}

initializeApp(); // existing line already there at end
