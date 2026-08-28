"use server";

import { createClient, getAuthUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAuthMadrasaId } from "@/app/actions/students";

export async function getBooks() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return [];

  const madrasaId = await getAuthMadrasaId(supabase, user);
  if (!madrasaId) return [];

  const { data, error } = await supabase
    .from("books")
    .select("*")
    .eq("madrasa_id", madrasaId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching books:", error);
    return [];
  }
  return data || [];
}

export async function createBook(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "অননুমোদিত অ্যাক্সেস (Unauthorized)" };

  const madrasaId = await getAuthMadrasaId(supabase, user);
  if (!madrasaId) return { error: "কোনো মাদ্রাসা পাওয়া যায়নি।" };

  const title = formData.get("title") as string;
  const author = formData.get("author") as string;
  const category = formData.get("category") as string;
  const totalCopiesStr = formData.get("total_copies") as string;

  if (!title) {
    return { error: "কিতাবের নাম আবশ্যক।" };
  }

  const totalCopies = parseInt(totalCopiesStr, 10) || 1;

  const { error } = await supabase.from("books").insert({
    madrasa_id: madrasaId,
    title,
    author: author || null,
    category: category || null,
    total_copies: totalCopies,
    available_copies: totalCopies,
  });

  if (error) {
    console.error("Error creating book:", error);
    return { error: `কিতাব যোগ করতে ত্রুটি: ${error.message}` };
  }

  revalidatePath("/dashboard/library");
  return { success: true };
}

export async function updateBook(id: string, prevState: any, formData: FormData) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "অননুমোদিত অ্যাক্সেস" };

  const title = formData.get("title") as string;
  const author = formData.get("author") as string;
  const category = formData.get("category") as string;
  const totalCopiesStr = formData.get("total_copies") as string;

  if (!title) {
    return { error: "কিতাবের নাম আবশ্যক।" };
  }

  // Get current book to adjust available copies
  const { data: book, error: getError } = await supabase
    .from("books")
    .select("*")
    .eq("id", id)
    .single();

  if (getError || !book) {
    return { error: "কিতাবটি খুঁজে পাওয়া যায়নি।" };
  }

  const newTotalCopies = parseInt(totalCopiesStr, 10) || 1;
  const difference = newTotalCopies - book.total_copies;
  const newAvailableCopies = Math.max(0, book.available_copies + difference);

  const { error } = await supabase
    .from("books")
    .update({
      title,
      author: author || null,
      category: category || null,
      total_copies: newTotalCopies,
      available_copies: newAvailableCopies,
    })
    .eq("id", id);

  if (error) {
    console.error("Error updating book:", error);
    return { error: `আপডেট করতে ত্রুটি: ${error.message}` };
  }

  revalidatePath("/dashboard/library");
  return { success: true };
}

export async function deleteBook(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("books").delete().eq("id", id);

  if (error) {
    console.error("Error deleting book:", error);
    return { error: error.message };
  }

  revalidatePath("/dashboard/library");
  return { success: true };
}

export async function getBookIssues() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return [];

  const madrasaId = await getAuthMadrasaId(supabase, user);
  if (!madrasaId) return [];

  const { data, error } = await supabase
    .from("book_issues")
    .select(`
      *,
      books ( id, title, author, category ),
      students ( id, first_name, last_name, roll_number, classes ( id, name ) )
    `)
    .eq("madrasa_id", madrasaId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching book issues:", error);
    return [];
  }
  return data || [];
}

export async function issueBook(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "অননুমোদিত অ্যাক্সেস" };

  const madrasaId = await getAuthMadrasaId(supabase, user);
  if (!madrasaId) return { error: "কোনো মাদ্রাসা পাওয়া যায়নি।" };

  const bookId = formData.get("book_id") as string;
  const studentId = formData.get("student_id") as string;
  const dueDateStr = formData.get("due_date") as string;
  const issueDateStr = formData.get("issue_date") as string;

  if (!bookId || !studentId) {
    return { error: "কিতাব এবং শিক্ষার্থী নির্বাচন করা আবশ্যক।" };
  }

  // Check if book has available copies
  const { data: book, error: bookError } = await supabase
    .from("books")
    .select("available_copies, title")
    .eq("id", bookId)
    .single();

  if (bookError || !book) {
    return { error: "কিতাবের তথ্য পাওয়া যায়নি।" };
  }

  if (book.available_copies <= 0) {
    return { error: `"${book.title}" এই কিতাবটি এখন স্টকে নেই (সবগুলো কপি ইস্যু করা আছে)।` };
  }

  // Issue the book
  const { error: issueError } = await supabase.from("book_issues").insert({
    madrasa_id: madrasaId,
    book_id: bookId,
    student_id: studentId,
    issue_date: issueDateStr || new Date().toISOString().split("T")[0],
    due_date: dueDateStr || null,
    status: "Issued",
  });

  if (issueError) {
    console.error("Error issuing book:", issueError);
    return { error: `কিতাব ইস্যু করতে ত্রুটি: ${issueError.message}` };
  }

  // Decrease available copies by 1
  const { error: updateError } = await supabase
    .from("books")
    .update({ available_copies: book.available_copies - 1 })
    .eq("id", bookId);

  if (updateError) {
    console.error("Error updating book available copies:", updateError);
  }

  revalidatePath("/dashboard/library");
  return { success: true };
}

export async function returnBook(issueId: string) {
  const supabase = await createClient();
  
  // Get issue details first to find the book
  const { data: issue, error: issueError } = await supabase
    .from("book_issues")
    .select("*, books(available_copies)")
    .eq("id", issueId)
    .single();

  if (issueError || !issue) {
    return { error: "ইস্যুর তথ্য খুঁজে পাওয়া যায়নি।" };
  }

  if (issue.status === "Returned") {
    return { error: "কিতাবটি ইতিমধ্যে ফেরত নেওয়া হয়েছে।" };
  }

  // Update issue status to Returned
  const { error: updateIssueError } = await supabase
    .from("book_issues")
    .update({
      status: "Returned",
      return_date: new Date().toISOString().split("T")[0],
    })
    .eq("id", issueId);

  if (updateIssueError) {
    console.error("Error updating issue status:", updateIssueError);
    return { error: `ফেরত নিতে ত্রুটি: ${updateIssueError.message}` };
  }

  // Increase available copies by 1
  if (issue.books) {
    const { error: updateBookError } = await supabase
      .from("books")
      .update({ available_copies: issue.books.available_copies + 1 })
      .eq("id", issue.book_id);

    if (updateBookError) {
      console.error("Error updating available copies on return:", updateBookError);
    }
  }

  revalidatePath("/dashboard/library");
  return { success: true };
}
