import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, StickyNote, Edit, Trash2, Star, StarOff, Search, Upload, X, Eye, Maximize2, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { LoadingCard } from '@/components/ui/loading-spinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NoteFullScreenView } from '@/components/NoteFullScreenView';

interface Note {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  images: string[];
  attachments?: string[];
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

const Notes = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notes, setNotes] = useState<Note[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [selectedPdfs, setSelectedPdfs] = useState<File[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [viewImageDialog, setViewImageDialog] = useState(false);
  const [selectedViewImage, setSelectedViewImage] = useState('');
  const [fullScreenNote, setFullScreenNote] = useState<Note | null>(null);
  const [fullScreenOpen, setFullScreenOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: '',
    tags: ''
  });

  const categories = ['General', 'Trading Ideas', 'Lessons Learned', 'Market Analysis', 'Personal'];

  useEffect(() => {
    if (user) {
      fetchNotes();
    }
  }, [user]);

  useEffect(() => {
    filterNotes();
  }, [notes, searchTerm, selectedCategory]);

  const fetchNotes = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      const notesWithAttachments = (data || []).map(note => ({
        ...note,
        attachments: (note as any).attachments || []
      }));
      setNotes(notesWithAttachments);
    } catch (error) {
      console.error('Error fetching notes:', error);
      toast({
        title: "Error",
        description: "Failed to fetch notes",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filterNotes = () => {
    let filtered = notes;

    if (searchTerm) {
      filtered = filtered.filter(note => 
        note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        note.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        note.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (selectedCategory !== 'all') {
      if (selectedCategory === 'favorites') {
        filtered = filtered.filter(note => note.is_favorite);
      } else {
        filtered = filtered.filter(note => note.category === selectedCategory);
      }
    }

    setFilteredNotes(filtered);
  };

  const uploadImages = async () => {
    if (selectedImages.length === 0) return [];
    
    setUploading(true);
    const uploadedUrls: string[] = [];

    try {
      for (const image of selectedImages) {
        const fileExt = image.name.split('.').pop();
        const fileName = `${user?.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('trade-screenshots')
          .upload(fileName, image);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('trade-screenshots')
          .getPublicUrl(fileName);

        uploadedUrls.push(publicUrl);
      }
    } catch (error) {
      console.error('Error uploading images:', error);
      toast({
        title: "Error",
        description: "Failed to upload some images",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }

    return uploadedUrls;
  };

  const uploadPdfs = async () => {
    if (selectedPdfs.length === 0) return [];
    
    const uploadedUrls: string[] = [];

    try {
      for (const pdf of selectedPdfs) {
        const fileExt = pdf.name.split('.').pop();
        const fileName = `${user?.id}/documents/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('trade-screenshots')
          .upload(fileName, pdf);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('trade-screenshots')
          .getPublicUrl(fileName);

        uploadedUrls.push(publicUrl);
      }
    } catch (error) {
      console.error('Error uploading PDFs:', error);
      toast({
        title: "Error",
        description: "Failed to upload some PDFs",
        variant: "destructive"
      });
    }

    return uploadedUrls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const uploadedImageUrls = await uploadImages();
      const uploadedPdfUrls = await uploadPdfs();
      const finalImageUrls = [...imageUrls, ...uploadedImageUrls];
      const finalAttachmentUrls = [...attachmentUrls, ...uploadedPdfUrls];

      const noteData = {
        title: formData.title,
        content: formData.content,
        category: formData.category,
        tags: formData.tags ? formData.tags.split(',').map(tag => tag.trim()) : [],
        images: finalImageUrls,
        attachments: finalAttachmentUrls,
        user_id: user.id
      };

      if (editingNote) {
        const { error } = await supabase
          .from('notes')
          .update(noteData)
          .eq('id', editingNote.id);

        if (error) throw error;
        toast({ title: "Success", description: "Note updated successfully" });
      } else {
        const { error } = await supabase
          .from('notes')
          .insert([noteData]);

        if (error) throw error;
        toast({ title: "Success", description: "Note created successfully" });
      }

      setDialogOpen(false);
      setEditingNote(null);
      resetForm();
      fetchNotes();
    } catch (error) {
      console.error('Error saving note:', error);
      toast({
        title: "Error",
        description: "Failed to save note",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (note: Note) => {
    setEditingNote(note);
    setFormData({
      title: note.title,
      content: note.content,
      category: note.category || '',
      tags: note.tags?.join(', ') || ''
    });
    setImageUrls(note.images || []);
    setAttachmentUrls(note.attachments || []);
    setSelectedImages([]);
    setSelectedPdfs([]);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: "Success", description: "Note deleted successfully" });
      fetchNotes();
    } catch (error) {
      console.error('Error deleting note:', error);
      toast({
        title: "Error",
        description: "Failed to delete note",
        variant: "destructive"
      });
    }
  };

  const toggleFavorite = async (note: Note) => {
    try {
      const { error } = await supabase
        .from('notes')
        .update({ is_favorite: !note.is_favorite })
        .eq('id', note.id);

      if (error) throw error;
      fetchNotes();
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast({
        title: "Error",
        description: "Failed to update note",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      category: '',
      tags: ''
    });
    setSelectedImages([]);
    setSelectedPdfs([]);
    setImageUrls([]);
    setAttachmentUrls([]);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedImages(prev => [...prev, ...files]);
  };

  const removeSelectedImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = (index: number) => {
    setImageUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handlePdfSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const pdfFiles = files.filter(file => file.type === 'application/pdf');
    if (pdfFiles.length !== files.length) {
      toast({
        title: "Invalid file type",
        description: "Please select only PDF files",
        variant: "destructive"
      });
    }
    setSelectedPdfs(prev => [...prev, ...pdfFiles]);
  };

  const removeSelectedPdf = (index: number) => {
    setSelectedPdfs(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingAttachment = (index: number) => {
    setAttachmentUrls(prev => prev.filter((_, i) => i !== index));
  };

  const openPdf = (pdfUrl: string) => {
    window.open(pdfUrl, '_blank');
  };

  const viewImage = (imageUrl: string) => {
    setSelectedViewImage(imageUrl);
    setViewImageDialog(true);
  };

  const openFullScreen = (note: Note) => {
    setFullScreenNote(note);
    setFullScreenOpen(true);
  };

  const handleFullScreenEdit = (note: Note) => {
    setFullScreenOpen(false);
    handleEdit(note);
  };

  const handleFullScreenDelete = (id: string) => {
    setFullScreenOpen(false);
    handleDelete(id);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header Skeleton */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-8 bg-muted rounded w-32 animate-pulse"></div>
              <div className="h-4 bg-muted rounded w-48 animate-pulse"></div>
            </div>
            <div className="h-10 bg-muted rounded w-32 animate-pulse"></div>
          </div>
          
          {/* Notes Grid Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <LoadingCard key={i} className="h-48" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notes</h1>
          <p className="text-muted-foreground">Keep track of your trading insights and ideas</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setEditingNote(null); }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Note
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingNote ? 'Edit' : 'Add'} Note</DialogTitle>
              <DialogDescription>
                {editingNote ? 'Update' : 'Create'} your trading note
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="tags">Tags (comma separated)</Label>
                <Input
                  id="tags"
                  placeholder="e.g., forex, strategy, analysis"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="content">Content</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={8}
                required
                />
              </div>
              
              {/* Image Upload Section */}
              <div>
                <Label htmlFor="images">Images</Label>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      id="images"
                      accept="image/*"
                      multiple
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('images')?.click()}
                      className="flex items-center gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      Add Images
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {selectedImages.length + imageUrls.length} image(s)
                    </span>
                  </div>
                  
                  {/* Display existing images */}
                  {imageUrls.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {imageUrls.map((url, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={url}
                            alt={`Note image ${index + 1}`}
                            className="w-full h-20 object-cover rounded border cursor-pointer"
                            onClick={() => viewImage(url)}
                          />
                          <button
                            type="button"
                            onClick={() => removeExistingImage(index)}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Display selected new images */}
                  {selectedImages.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {selectedImages.map((file, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`Selected ${index + 1}`}
                            className="w-full h-20 object-cover rounded border"
                          />
                          <button
                            type="button"
                            onClick={() => removeSelectedImage(index)}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* PDF Upload Section */}
              <div>
                <Label htmlFor="pdfs">PDF Documents</Label>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      id="pdfs"
                      accept=".pdf"
                      multiple
                      onChange={handlePdfSelect}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('pdfs')?.click()}
                      className="flex items-center gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      Add PDFs
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {selectedPdfs.length + attachmentUrls.length} PDF(s)
                    </span>
                  </div>
                  
                  {/* Display existing PDFs */}
                  {attachmentUrls.length > 0 && (
                    <div className="space-y-2">
                      {attachmentUrls.map((url, index) => {
                        const fileName = url.split('/').pop() || `document-${index + 1}.pdf`;
                        return (
                          <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-2">
                              <div className="p-2 bg-red-100 rounded-md">
                                <FileText className="h-4 w-4 text-red-600" />
                              </div>
                              <span className="text-sm text-muted-foreground truncate">{fileName}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => openPdf(url)}
                                className="h-8 w-8 p-0"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeExistingAttachment(index)}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-800"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Display selected new PDFs */}
                  {selectedPdfs.length > 0 && (
                    <div className="space-y-2">
                      {selectedPdfs.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                          <div className="flex items-center gap-2">
                            <div className="p-2 bg-blue-100 rounded-md">
                              <FileText className="h-4 w-4 text-blue-600" />
                            </div>
                            <span className="text-sm truncate">{file.name}</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeSelectedPdf(index)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-800"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <Button type="submit" className="w-full" disabled={uploading}>
                {uploading ? 'Uploading...' : editingNote ? 'Update' : 'Create'} Note
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="favorites">Favorites</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredNotes.length === 0 ? (
        <div className="text-center py-12">
          <StickyNote className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">
            {notes.length === 0 ? 'No notes yet' : 'No notes found'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {notes.length === 0 
              ? 'Start documenting your trading insights and ideas' 
              : 'Try adjusting your search or filter criteria'
            }
          </p>
          {notes.length === 0 && (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Note
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredNotes.map((note) => (
            <Card key={note.id} className="h-fit">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg line-clamp-2">{note.title}</CardTitle>
                    <div className="flex items-center space-x-2 mt-2">
                      {note.category && (
                        <Badge variant="secondary" className="text-xs">
                          {note.category}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDate(note.updated_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openFullScreen(note)}
                      title="View full screen"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleFavorite(note)}
                    >
                      {note.is_favorite ? (
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      ) : (
                        <StarOff className="h-4 w-4" />
                      )}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(note)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(note.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-4 mb-3">
                  {note.content}
                </p>
                
                {/* Display note images */}
                {note.images && note.images.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {note.images.slice(0, 4).map((image, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={image}
                          alt={`Note image ${index + 1}`}
                          className="w-full h-24 object-cover rounded border cursor-pointer"
                          onClick={() => viewImage(image)}
                        />
                        {note.images.length > 4 && index === 3 && (
                          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded text-white text-sm">
                            +{note.images.length - 4} more
                          </div>
                        )}
                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 bg-white/80 hover:bg-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              viewImage(image);
                            }}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Display note PDFs */}
                {note.attachments && note.attachments.length > 0 && (
                  <div className="space-y-2 mb-3">
                    <p className="text-xs text-muted-foreground font-medium">Attachments:</p>
                    {note.attachments.slice(0, 3).map((pdf, index) => {
                      const fileName = pdf.split('/').pop() || `document-${index + 1}.pdf`;
                      return (
                        <div key={index} className="flex items-center justify-between p-2 border rounded-md bg-muted/30">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="p-1 bg-red-100 rounded">
                              <FileText className="h-3 w-3 text-red-600" />
                            </div>
                            <span className="text-xs text-muted-foreground truncate">{fileName}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openPdf(pdf);
                            }}
                            className="h-6 w-6 p-0"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                        </div>
                      );
                    })}
                    {note.attachments.length > 3 && (
                      <p className="text-xs text-muted-foreground">+{note.attachments.length - 3} more PDF(s)</p>
                    )}
                  </div>
                )}
                
                {note.tags && note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {note.tags.map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {/* Image View Dialog */}
      <Dialog open={viewImageDialog} onOpenChange={setViewImageDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>View Image</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center">
            <img
              src={selectedViewImage}
              alt="Note image"
              className="max-w-full max-h-[70vh] object-contain rounded"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Full Screen Note View */}
      <NoteFullScreenView
        note={fullScreenNote}
        open={fullScreenOpen}
        onOpenChange={setFullScreenOpen}
        onEdit={handleFullScreenEdit}
        onDelete={handleFullScreenDelete}
        onToggleFavorite={toggleFavorite}
        onImageClick={viewImage}
      />
      </div>
    </DashboardLayout>
  );
};

export default Notes;