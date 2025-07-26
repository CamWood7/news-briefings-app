from flask import Flask, request, jsonify
from flask_cors import CORS
from gdeltdoc import GdeltDoc, Filters
import pandas as pd
from newspaper import Article
import re
import nltk
import os
import openai
from dotenv import load_dotenv

load_dotenv()

# nltk.download('punkt')  # Uncomment if punkt is not downloaded

app = Flask(__name__)
CORS(app)

gd = GdeltDoc()

openai.api_key = os.getenv('OPENAI_API_KEY')

# Initialize Supabase client (if needed for future features)
# supabase_url = os.getenv('SUPABASE_URL')
# supabase_key = os.getenv('SUPABASE_ANON_KEY')
# supabase: Client = create_client(supabase_url, supabase_key)

@app.route('/api/news', methods=['POST'])
def get_news():
    data = request.get_json()
    topic = data.get('topic', '')
    start_date = data.get('start_date', '2024-05-01')
    end_date = data.get('end_date', '2024-05-07')
    if not topic:
        return jsonify({'error': 'Missing topic'}), 400
    f = Filters(
        keyword=topic,
        num_records=10,  # Fetch more to ensure we get at least 5
        language="eng",
        country = "US",
        start_date=start_date,
        end_date=end_date
    )
    articles = gd.article_search(f)
    if isinstance(articles, pd.DataFrame):
        articles = articles.to_dict(orient='records')
    
    # Function to check if titles are similar (not just exact matches)
    def titles_are_similar(title1, title2, threshold=0.8):
        """Check if two titles are similar using simple string comparison"""
        if not title1 or not title2:
            return False
        
        # Normalize titles for comparison
        t1 = title1.lower().strip()
        t2 = title2.lower().strip()
        
        # Exact match
        if t1 == t2:
            return True
        
        # Check if one title is contained in the other (for very similar titles)
        if t1 in t2 or t2 in t1:
            return True
        
        # Check for high word overlap
        words1 = set(t1.split())
        words2 = set(t2.split())
        
        if len(words1) > 0 and len(words2) > 0:
            overlap = len(words1.intersection(words2))
            total_words = len(words1.union(words2))
            similarity = overlap / total_words
            return similarity >= threshold
        
        return False
    
    # Filter out similar titles and limit to 4 articles
    filtered_articles = []
    for article in articles:
        title = article.get('title', '')
        
        # Check if this title is similar to any already selected article
        is_duplicate = any(
            titles_are_similar(title, existing_article.get('title', ''))
            for existing_article in filtered_articles
        )
        
        if not is_duplicate and len(filtered_articles) < 4:
            filtered_articles.append(article)
        
        if len(filtered_articles) >= 4:
            break
    
    # Return only the first 4 articles with more details
    result = [
        {
            'url': a.get('url', ''),
            'url_mobile': a.get('url_mobile', ''),
            'title': a.get('title', ''),
            'seendate': a.get('seendate', '') or a.get('date', ''),
            'socialimage': a.get('socialimage', ''),
            'domain': a.get('domain', ''),
            'language': a.get('language', ''),
            'sourcecountry': a.get('sourcecountry', ''),
            'summary': a.get('snippet', '') or a.get('summary', '')
        }
        for a in filtered_articles
    ]
    return jsonify({'articles': result})

def summarize_article(url, max_tokens=1000):
    article = Article(url)
    article.download()
    article.parse()
    article_text = article.text
    # Remove extra whitespace and newlines
    article_text = re.sub(r'\s+', ' ', article_text).strip()
    # Tokenize into sentences
    sentences = nltk.sent_tokenize(article_text)
    # Keep sentences until max token limit is reached (approx. 4 chars per token)
    approx_chars_per_token = 4
    max_chars = max_tokens * approx_chars_per_token
    truncated_text = ""
    char_count = 0
    for sentence in sentences:
        if char_count + len(sentence) > max_chars:
            break
        truncated_text += sentence + " "
        char_count += len(sentence)
    return truncated_text.strip()

@app.route('/api/summarize', methods=['POST'])
def summarize():
    data = request.get_json()
    url = data.get('url')
    if not url:
        return jsonify({'error': 'Missing url'}), 400
    try:
        summary = summarize_article(url)
        return jsonify({'summary': summary})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/summarize_all', methods=['POST'])
def summarize_all():
    data = request.get_json()
    articles = data.get('articles', [])
    if not articles or not isinstance(articles, list):
        return jsonify({'error': 'Missing or invalid articles'}), 400
    # Compose a prompt for OpenAI
    prompt = """
You are a professional news analyst. You MUST provide individual summaries for EACH article first, then an overall summary.

CRITICAL REQUIREMENTS:
1. You MUST start with individual article summaries (Article 1:, Article 2:, etc.)
2. You MUST provide 3 bullet points for each individual article
3. You MUST end with "All Articles Summary:" section
4. DO NOT skip individual articles or go straight to the overall summary
5. DO NOT start bullet points with phrases like "The article", "This article", "The story", etc.
6. Write bullet points as direct statements of facts, insights, or implications

REQUIRED FORMAT (you MUST follow this exactly):
Article 1:
- Key insight with data/context
- Additional important detail
- Additional important detail

Article 2:
- Key insight with data/context
- Additional important detail
- Additional important detail

[Continue for each article...]

All Articles Summary:
- Main theme or trend across articles
- Additional synthesis point
- Additional synthesis point
- Final insight if relevant

Articles to summarize:
"""
    for idx, article in enumerate(articles, 1):
        prompt += f"\nArticle {idx} Title: {article.get('title', '')}\nContent: {article.get('summary', '')}"
    prompt += "\n\nSummaries:"
    try:
        response = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1500,
            temperature=0.3
        )
        summary_text = response.choices[0].message.content.strip()
        # Parse the response into per-article and global summary
        # (Frontend can display as plain text or parse further)
        return jsonify({'summary': summary_text})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/summarize_topic', methods=['POST'])
def summarize_topic():
    data = request.get_json()
    topic = data.get('topic', '')
    bullet_points = data.get('bulletPoints', [])
    
    if not topic or not bullet_points:
        return jsonify({'error': 'Missing topic or bullet points'}), 400
    
    # Compose a prompt for OpenAI to synthesize the bullet points
    prompt = f"""
You are a professional news analyst. Below are bullet points from multiple articles about {topic}. 

Your task is to synthesize these bullet points into 3-4 concise, insightful bullet points that capture the key themes, trends, and implications for {topic}.

CRITICAL REQUIREMENTS:
1. DO NOT start bullet points with phrases like "The article", "This article", "The story", etc.
2. Write bullet points as direct statements of facts, insights, or implications
3. Focus on synthesizing the information, not describing individual articles
4. Identify common themes and patterns across the bullet points
5. Provide actionable insights and implications

Original bullet points for {topic}:
"""
    
    for i, bullet in enumerate(bullet_points, 1):
        prompt += f"{i}. {bullet}\n"
    
    prompt += f"""

Synthesized bullet points for {topic}:
• """
    
    try:
        response = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0.3
        )
        summary_text = response.choices[0].message.content.strip()
        
        # Ensure the response starts with bullet points
        if not summary_text.startswith('•'):
            summary_text = '• ' + summary_text
        
        return jsonify({'summary': summary_text})
    except Exception as e:
        return jsonify({'error': str(e)}), 500



if __name__ == '__main__':
    app.run(port=5001, debug=True) 