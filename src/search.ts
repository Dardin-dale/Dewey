/**
 * Web search functionality for finding book information
 */
import axios from 'axios';
import { WebSearchResult } from './types';

export class BookSearchService {
  /**
   * Search for book information using DuckDuckGo's API
   * This is a simple approach that doesn't require API keys
   */
  public async searchBook(bookTitle: string): Promise<string> {
    try {
      // Simple web search using DuckDuckGo's instant answer API
      const searchQuery = encodeURIComponent(`${bookTitle} book synopsis`);
      const url = `https://api.duckduckgo.com/?q=${searchQuery}&format=json&no_html=1`;

      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Dewey-BookBot/1.0'
        }
      });

      const data = response.data;

      // Combine relevant information from DDG response
      let searchInfo = '';

      if (data.AbstractText) {
        searchInfo += `${data.AbstractText}\n\n`;
      }

      if (data.RelatedTopics && data.RelatedTopics.length > 0) {
        const topics = data.RelatedTopics
          .filter((topic: any) => topic.Text)
          .slice(0, 3)
          .map((topic: any) => topic.Text);

        if (topics.length > 0) {
          searchInfo += `Additional information:\n${topics.join('\n')}\n`;
        }
      }

      return searchInfo.trim() || `No detailed information found for "${bookTitle}"`;
    } catch (error) {
      console.error('Search error:', error);
      // Return empty string so LLM can still generate based on its knowledge
      return '';
    }
  }

  /**
   * Search for multiple books in parallel
   */
  public async searchBooks(bookTitles: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    // Search all books in parallel
    const searches = bookTitles.map(async (title) => {
      const searchResult = await this.searchBook(title);
      results.set(title, searchResult);
    });

    await Promise.all(searches);

    return results;
  }
}

// Export a singleton instance
export const bookSearchService = new BookSearchService();
