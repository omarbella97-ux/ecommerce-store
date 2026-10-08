import Form from "next/form";
import { SearchIcon } from "@/components/icons";
import { SEARCH_MAX_LENGTH } from "@/lib/products";

// Underlined GET form that navigates to /search?q=…. Keyed on the query so
// the field resets to the URL's value on back/forward navigation.
export function SearchForm({ query = "" }: { query?: string }) {
  return (
    <Form
      action="/search"
      role="search"
      className="mt-3 flex w-full max-w-prose items-center border-b border-ink has-[input:focus-visible]:shadow-[0_1px_0_var(--color-ink)]"
    >
      <label htmlFor="search-query" className="sr-only">
        Search products
      </label>
      <input
        key={query}
        id="search-query"
        type="search"
        name="q"
        defaultValue={query}
        placeholder="Search products"
        maxLength={SEARCH_MAX_LENGTH}
        autoComplete="off"
        enterKeyHint="search"
        // Arriving from the header icon: ready to type.
        autoFocus={!query}
        className="h-12 min-w-0 flex-1 bg-transparent text-lead tracking-tight placeholder:text-subtle focus-visible:outline-none [&::-webkit-search-cancel-button]:appearance-none"
      />
      <button type="submit" className="btn-icon" aria-label="Search">
        <SearchIcon />
      </button>
    </Form>
  );
}
