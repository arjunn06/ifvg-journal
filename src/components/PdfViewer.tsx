import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Download, ExternalLink } from 'lucide-react';

interface PdfViewerProps {
  pdfUrl: string;
  fileName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PdfViewer({ pdfUrl, fileName, open, onOpenChange }: PdfViewerProps) {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = fileName || 'document.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenExternal = () => {
    window.open(pdfUrl, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">
              {fileName || 'PDF Document'}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenExternal}
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Open External
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
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          <iframe
            src={pdfUrl}
            className="w-full h-[calc(90vh-80px)] border-0"
            title={fileName || 'PDF Document'}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}