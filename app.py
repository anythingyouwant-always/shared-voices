from flask import Flask, request, jsonify, send_from_directory, render_template
from flask_cors import CORS
import sqlite3

app = Flask(__name__)
CORS(app)

DATABASE = 'storyweaver.db'

# (rest of your existing app.py code...)


def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    # Create stories table for story titles and main metadata
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS stories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            created_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    # Create story_segments table for individual contributions to a story
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS story_segments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            story_id INTEGER NOT NULL,
            text TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (story_id) REFERENCES stories (id)
        )
    ''')
    conn.commit()
    conn.close()

# Initialize the database
init_db()

@app.route('/')
def home():
    return render_template('index.html')
# # Old single-story endpoints (commented out)
# @app.route('/story', methods=['POST'])
# def add_story_segment_old():
#     data = request.get_json()
#     if not data or not data.get('text') or data['text'].strip() == '':
#         return jsonify({"error": "Missing or empty text field"}), 400
#     text = data['text']
#     conn = get_db_connection()
#     cursor = conn.cursor()
#     # This used to insert into the old 'stories' table which is now for story titles
#     # cursor.execute('INSERT INTO stories (text) VALUES (?)', (text,))
#     conn.commit()
#     last_id = cursor.lastrowid
#     conn.close()
#     return jsonify({"message": "Story segment added (old endpoint)", "id": last_id}), 201

# @app.route('/story', methods=['GET'])
# def get_story_segments_old():
#     conn = get_db_connection()
#     cursor = conn.cursor()
#     # This used to select from the old 'stories' table
#     # cursor.execute('SELECT id, text, timestamp FROM stories ORDER BY timestamp ASC')
#     segments_rows = [] # cursor.fetchall()
#     conn.close()
#     segments = []
#     for row in segments_rows:
#         segments.append(dict(row))
#     return jsonify(segments)

# --- New Multi-Story Endpoints ---

# Endpoint to create a new story
@app.route('/stories', methods=['POST'])
def create_story():
    data = request.get_json()
    if not data or not data.get('title') or data['title'].strip() == '':
        return jsonify({"error": "Missing or empty title field"}), 400

    title = data['title'].strip()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('INSERT INTO stories (title) VALUES (?)', (title,))
    conn.commit()
    new_story_id = cursor.lastrowid
    cursor.execute('SELECT id, title, created_timestamp FROM stories WHERE id = ?', (new_story_id,))
    new_story = cursor.fetchone()
    conn.close()

    if new_story:
        return jsonify(dict(new_story)), 201
    else:
        return jsonify({"error": "Failed to create story after insert"}), 500

@app.route('/stories', methods=['GET'])
def get_all_stories():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id, title, created_timestamp FROM stories ORDER BY created_timestamp DESC')
    stories_rows = cursor.fetchall()
    conn.close()
    stories_list = [dict(row) for row in stories_rows]
    return jsonify(stories_list)

@app.route('/stories/<int:story_id>/segments', methods=['GET'])
def get_segments_for_story(story_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id FROM stories WHERE id = ?', (story_id,))
    story_exists = cursor.fetchone()
    if not story_exists:
        conn.close()
        return jsonify({"error": "Story not found"}), 404

    cursor.execute('''
        SELECT id, story_id, text, timestamp 
        FROM story_segments 
        WHERE story_id = ? 
        ORDER BY timestamp ASC
    ''', (story_id,))
    segments_rows = cursor.fetchall()
    conn.close()

    segments_list = [dict(row) for row in segments_rows]
    return jsonify(segments_list)

@app.route('/stories/<int:story_id>/segments', methods=['POST'])
def add_segment_to_story(story_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id FROM stories WHERE id = ?', (story_id,))
    story_exists = cursor.fetchone()
    if not story_exists:
        conn.close()
        return jsonify({"error": "Story not found, cannot add segment"}), 404

    data = request.get_json()
    if not data or not data.get('text') or data['text'].strip() == '':
        conn.close()
        return jsonify({"error": "Missing or empty text field for segment"}), 400

    text = data['text'].strip()
    cursor.execute('INSERT INTO story_segments (story_id, text) VALUES (?, ?)', (story_id, text))
    conn.commit()
    new_segment_id = cursor.lastrowid
    conn.close()

    return jsonify({"message": "Segment added", "segment_id": new_segment_id}), 201

# Endpoint to delete a whole story
@app.route('/stories/<int:story_id>', methods=['DELETE'])
def delete_story(story_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT id FROM stories WHERE id = ?', (story_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({"error": "Story not found"}), 404

    cursor.execute('DELETE FROM story_segments WHERE story_id = ?', (story_id,))
    cursor.execute('DELETE FROM stories WHERE id = ?', (story_id,))

    conn.commit()
    conn.close()
    return jsonify({"message": "Story and segments deleted successfully"}), 200

# Endpoint to delete a specific segment
@app.route('/stories/<int:story_id>/segments/<int:segment_id>', methods=['DELETE'])
def delete_segment(story_id, segment_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT id FROM story_segments WHERE id = ? AND story_id = ?', (segment_id, story_id))
    if not cursor.fetchone():
        conn.close()
        return jsonify({"error": "Segment not found"}), 404

    cursor.execute('DELETE FROM story_segments WHERE id = ?', (segment_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Segment deleted successfully"}), 200

# Static files route (explicit and clear)
@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static_files(path):
    return send_from_directory('.', path)
  
if __name__ == '__main__':
    app.run(debug=True)