import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Star, StarOff, Edit, Trash2, ChevronLeft, ChevronRight, FileText, Eye } from 'lucide-react';
import { PdfViewer } from './PdfViewer';
import { useState } from 'react';

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

interface NoteFullScreenViewProps {
  note: Note | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (note: Note) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (note: Note) => void;
  onImageClick: (imageUrl: string) => void;
}

export function NoteFullScreenView({
  note,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onToggleFavorite,
  onImageClick
}: NoteFullScreenViewProps) {
  const [selectedPdf, setSelectedPdf] = useState<{ url: string; fileName: string } | null>(null);
  
  if (!note) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const openPdf = (pdfUrl: string) => {
    const fileName = pdfUrl.split('/').pop() || 'document.pdf';
    setSelectedPdf({ url: pdfUrl, fileName });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        {/* Header */}
        <div className="border-b border-border p-6 flex items-start justify-between">
          <div className="flex-1 mr-4">
            <h1 className="text-2xl font-bold mb-2">{note.title}</h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              {note.category && (
                <Badge variant="secondary">{note.category}</Badge>
              )}
              <span>Created: {formatDate(note.created_at)}</span>
              {note.updated_at !== note.created_at && (
                <span>Updated: {formatDate(note.updated_at)}</span>
              )}
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleFavorite(note)}
            >
              {note.is_favorite ? (
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              ) : (
                <StarOff className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(note)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(note.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Note content */}
          <div className="prose prose-sm max-w-none mb-6">
            <div className="whitespace-pre-wrap text-foreground leading-relaxed">
              {note.content}
            </div>
          </div>

          {/* Images */}
          {note.images && note.images.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-3">Images</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {note.images.map((image, index) => (
                  <div key={index} className="group cursor-pointer">
                    <img
                      src={image}
                      alt={`Note image ${index + 1}`}
                      className="w-full h-48 object-cover rounded-lg border border-border group-hover:border-primary transition-colors"
                      onClick={() => onImageClick(image)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PDF Attachments */}
          {note.attachments && note.attachments.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-3">Attachments</h3>
              <div className="space-y-3">
                {note.attachments.map((pdf, index) => {
                  const fileName = pdf.split('/').pop() || `document-${index + 1}.pdf`;
                  return (
                    <div key={index} className="flex items-center justify-between p-4 border border-border rounded-lg hover:border-primary transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded-md">
                          <FileText className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{fileName}</p>
                          <p className="text-xs text-muted-foreground">PDF Document</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openPdf(pdf)}
                        className="flex items-center gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        Open
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tags */}
          {note.tags && note.tags.length > 0 && (
            <div>
              <h3 className="text-lg font-medium mb-3">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {note.tags.map((tag, index) => (
                  <Badge key={index} variant="outline">
                    #{tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
      
      <PdfViewer
        pdfUrl={selectedPdf?.url || ''}
        fileName={selectedPdf?.fileName}
        open={!!selectedPdf}
        onOpenChange={(open) => !open && setSelectedPdf(null)}
      />
    </Dialog>
  );
}