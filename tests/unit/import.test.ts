import { describe, expect, it } from "vitest";
import { htmlToMarkdown, splitTitle, stableId, titleFromFilename } from "@/lib/import/html";
import { blocksToMarkdown, databaseTitles, searchNotion, titleOf, NotionError, type Fetch, type NotionBlock } from "@/lib/notion/api";

describe("htmlToMarkdown", () => {
  it("converts Apple Notes style HTML", () => {
    const md = htmlToMarkdown(`<div><h1>Grocery list</h1></div><div>Weekend <b>shopping</b> &amp; errands<br></div><ul><li>Milk</li><li>Bread</li></ul><div><a href="https://x.com">link</a></div>`);
    expect(md).toContain("# Grocery list");
    expect(md).toContain("Weekend **shopping** & errands");
    expect(md).toContain("- Milk");
    expect(md).toContain("[link](https://x.com)");
  });
  it("drops images, scripts and comments, and collapses blank lines", () => {
    expect(htmlToMarkdown(`<style>x{}</style><!-- c --><div>a</div><div></div><div></div><div></div><img src="x"><div>b</div>`)).toBe("a\n\nb");
  });
  it("decodes numeric entities", () => {
    expect(htmlToMarkdown("<div>caf&#233; &#x2713;</div>")).toBe("café ✓");
  });
});

describe("splitTitle / titleFromFilename / stableId", () => {
  it("uses the first heading or line as the title", () => {
    expect(splitTitle("# Trip plan\nBook train", "x")).toEqual({ title: "Trip plan", body: "Book train" });
    expect(splitTitle("\n\n**Idea**\nmore", "x")).toEqual({ title: "Idea", body: "more" });
  });
  it("falls back when the first line is too long or the note is empty", () => {
    expect(splitTitle("a".repeat(200), "Fallback").title).toBe("Fallback");
    expect(splitTitle("   \n", "Empty").title).toBe("Empty");
  });
  it("cleans export file names", () => {
    expect(titleFromFilename("12-Grocery_list.html")).toBe("Grocery list");
    expect(titleFromFilename(".md")).toBe("Untitled");
  });
  it("makes the same id for the same file and a different one for different content", () => {
    expect(stableId("a.md", "x")).toBe(stableId("a.md", "x"));
    expect(stableId("a.md", "x")).not.toBe(stableId("a.md", "y"));
  });
});

const para = (t: string, extra: Partial<NotionBlock> = {}): NotionBlock => ({ id: t, type: "paragraph", paragraph: { rich_text: [{ plain_text: t }] }, ...extra });

describe("blocksToMarkdown", () => {
  it("renders common blocks with formatting and numbering", () => {
    const blocks: NotionBlock[] = [
      { id: "1", type: "heading_2", heading_2: { rich_text: [{ plain_text: "Plan" }] } },
      para("Hello"),
      { id: "3", type: "to_do", to_do: { rich_text: [{ plain_text: "Call Mum" }], checked: true } },
      { id: "4", type: "numbered_list_item", numbered_list_item: { rich_text: [{ plain_text: "one" }] } },
      { id: "5", type: "numbered_list_item", numbered_list_item: { rich_text: [{ plain_text: "two", annotations: { bold: true } }] } },
      { id: "6", type: "code", code: { rich_text: [{ plain_text: "x = 1" }], language: "python" } },
      { id: "7", type: "unsupported_thing" },
    ];
    const md = blocksToMarkdown(blocks);
    expect(md).toContain("## Plan");
    expect(md).toContain("- [x] Call Mum");
    expect(md).toContain("1. one");
    expect(md).toContain("2. **two**");
    expect(md).toContain("```python\nx = 1\n```");
    expect(md).not.toContain("unsupported");
  });
  it("indents nested children", () => {
    const md = blocksToMarkdown([{ id: "p", type: "bulleted_list_item", bulleted_list_item: { rich_text: [{ plain_text: "parent" }] }, children: [{ id: "c", type: "bulleted_list_item", bulleted_list_item: { rich_text: [{ plain_text: "child" }] } }] }]);
    expect(md).toBe("- parent\n  - child");
  });
});

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

describe("notion search", () => {
  it("reads titles for pages and databases and follows pagination", async () => {
    let n = 0;
    const f: Fetch = async () => {
      n++;
      return n === 1
        ? json(200, { results: [{ id: "p1", object: "page", properties: { Name: { type: "title", title: [{ plain_text: "Trip plan" }] } } }], has_more: true, next_cursor: "c2" })
        : json(200, { results: [{ id: "d1", object: "database", title: [{ plain_text: "Tasks DB" }] }], has_more: false, next_cursor: null });
    };
    const r = await searchNotion(f, "tok");
    expect(r.map((x) => `${x.kind}:${x.title}`)).toEqual(["page:Trip plan", "database:Tasks DB"]);
  });
  it("turns API errors into NotionError", async () => {
    const f: Fetch = async () => json(401, { message: "API token is invalid." });
    await expect(searchNotion(f, "bad")).rejects.toBeInstanceOf(NotionError);
  });
  it("lists database row titles and skips untitled rows", async () => {
    const f: Fetch = async () => json(200, { results: [{ id: "a", object: "page", properties: { N: { type: "title", title: [{ plain_text: "Buy milk" }] } } }, { id: "b", object: "page", properties: { N: { type: "title", title: [] } } }], has_more: false, next_cursor: null });
    expect(await databaseTitles(f, "tok", "db")).toEqual(["Buy milk"]);
  });
  it("reads a page title from whichever property is the title", () => {
    expect(titleOf({ id: "x", object: "page", properties: { Other: { type: "rich_text" }, Name: { type: "title", title: [{ plain_text: "Hi" }] } } })).toBe("Hi");
  });
});
