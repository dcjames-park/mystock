export type Post = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  author_name: string;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      posts: {
        Row: Post;
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          content: string;
          author_name: string;
          created_at?: string;
        };
        Update: Partial<Post>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
