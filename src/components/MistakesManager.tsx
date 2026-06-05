import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Plus, X, Tag, AlertTriangle } from 'lucide-react';

interface Mistake {
  id: string;
  mistake_tag: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

interface MistakeTag {
  id: string;
  tag_name: string;
  category: string;
  color: string;
}

interface MistakesManagerProps {
  tradeId?: string;
  mistakes?: Mistake[];
  onMistakesChange?: (mistakes: Mistake[]) => void;
  className?: string;
}

const MistakesManager = ({ tradeId, mistakes = [], onMistakesChange, className = "" }: MistakesManagerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [availableTags, setAvailableTags] = useState<MistakeTag[]>([]);
  const [localMistakes, setLocalMistakes] = useState<Mistake[]>(mistakes);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTagDialog, setNewTagDialog] = useState(false);
  const [formData, setFormData] = useState({
    mistake_tag: '',
    description: '',
    severity: 'medium' as const
  });
  const [newTag, setNewTag] = useState({
    tag_name: '',
    category: '',
    color: '#ef4444'
  });

  useEffect(() => {
    if (user) {
      fetchMistakeTags();
    }
  }, [user]);

  useEffect(() => {
    setLocalMistakes(mistakes);
  }, [mistakes]);

  const fetchMistakeTags = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('mistake_tags')
        .select('*')
        .eq('user_id', user.id)
        .order('tag_name');

      if (error) throw error;
      setAvailableTags(data || []);
    } catch (error) {
      console.error('Error fetching mistake tags:', error);
    }
  };

  const createMistakeTag = async () => {
    if (!user || !newTag.tag_name.trim()) return;

    try {
      const { data, error } = await supabase
        .from('mistake_tags')
        .insert([{
          tag_name: newTag.tag_name.trim(),
          category: newTag.category.trim() || 'General',
          color: newTag.color,
          user_id: user.id
        }])
        .select()
        .single();

      if (error) throw error;

      setAvailableTags(prev => [...prev, data]);
      setNewTag({ tag_name: '', category: '', color: '#ef4444' });
      setNewTagDialog(false);
      
      toast({
        title: "Success",
        description: "Mistake tag created successfully"
      });
    } catch (error: any) {
      console.error('Error creating mistake tag:', error);
      toast({
        title: "Error",
        description: error.message?.includes('duplicate') ? 'Tag already exists' : 'Failed to create mistake tag',
        variant: "destructive"
      });
    }
  };

  const addMistake = async () => {
    if (!user || !formData.mistake_tag.trim()) return;

    const newMistake: Mistake = {
      id: crypto.randomUUID(),
      mistake_tag: formData.mistake_tag,
      description: formData.description,
      severity: formData.severity
    };

    const updatedMistakes = [...localMistakes, newMistake];
    setLocalMistakes(updatedMistakes);
    onMistakesChange?.(updatedMistakes);

    // If we have a tradeId, save to database immediately
    if (tradeId) {
      try {
        const { error } = await supabase
          .from('trade_mistakes')
          .insert([{
            trade_id: tradeId,
            mistake_tag: formData.mistake_tag,
            description: formData.description,
            severity: formData.severity,
            user_id: user.id
          }]);

        if (error) throw error;
      } catch (error) {
        console.error('Error saving mistake:', error);
        toast({
          title: "Error",
          description: "Failed to save mistake",
          variant: "destructive"
        });
      }
    }

    setFormData({ mistake_tag: '', description: '', severity: 'medium' });
    setDialogOpen(false);
  };

  const removeMistake = async (mistakeId: string) => {
    const updatedMistakes = localMistakes.filter(m => m.id !== mistakeId);
    setLocalMistakes(updatedMistakes);
    onMistakesChange?.(updatedMistakes);

    // If we have a tradeId, remove from database
    if (tradeId) {
      try {
        const { error } = await supabase
          .from('trade_mistakes')
          .delete()
          .eq('id', mistakeId)
          .eq('user_id', user.id);

        if (error) throw error;
      } catch (error) {
        console.error('Error removing mistake:', error);
        toast({
          title: "Error",
          description: "Failed to remove mistake",
          variant: "destructive"
        });
      }
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'secondary';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high': return <AlertTriangle className="h-3 w-3" />;
      case 'medium': return <AlertTriangle className="h-3 w-3" />;
      case 'low': return <AlertTriangle className="h-3 w-3" />;
      default: return <AlertTriangle className="h-3 w-3" />;
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Trading Mistakes
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add Mistake
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Trading Mistake</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="mistake_tag">Mistake Tag</Label>
                  <div className="flex gap-2">
                    <Select value={formData.mistake_tag} onValueChange={(value) => setFormData({...formData, mistake_tag: value})}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select or create a tag" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTags.map(tag => (
                          <SelectItem key={tag.id} value={tag.tag_name}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: tag.color }}
                              />
                              {tag.tag_name}
                              {tag.category && (
                                <span className="text-xs text-muted-foreground">({tag.category})</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Dialog open={newTagDialog} onOpenChange={setNewTagDialog}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Create New Mistake Tag</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="tag_name">Tag Name</Label>
                            <Input
                              id="tag_name"
                              value={newTag.tag_name}
                              onChange={(e) => setNewTag({...newTag, tag_name: e.target.value})}
                              placeholder="e.g., FOMO, Overtrading, Poor Entry"
                            />
                          </div>
                          <div>
                            <Label htmlFor="category">Category (Optional)</Label>
                            <Input
                              id="category"
                              value={newTag.category}
                              onChange={(e) => setNewTag({...newTag, category: e.target.value})}
                              placeholder="e.g., Psychology, Technical, Risk Management"
                            />
                          </div>
                          <div>
                            <Label htmlFor="color">Color</Label>
                            <div className="flex gap-2">
                              <Input
                                id="color"
                                type="color"
                                value={newTag.color}
                                onChange={(e) => setNewTag({...newTag, color: e.target.value})}
                                className="w-16 h-10"
                              />
                              <Input
                                value={newTag.color}
                                onChange={(e) => setNewTag({...newTag, color: e.target.value})}
                                placeholder="#ef4444"
                                className="flex-1"
                              />
                            </div>
                          </div>
                          <Button onClick={createMistakeTag} className="w-full">
                            Create Tag
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                <div>
                  <Label htmlFor="severity">Severity</Label>
                  <Select value={formData.severity} onValueChange={(value: any) => setFormData({...formData, severity: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Describe what went wrong and how to avoid it..."
                    rows={3}
                  />
                </div>

                <Button onClick={addMistake} className="w-full" disabled={!formData.mistake_tag.trim()}>
                  Add Mistake
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {localMistakes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No mistakes recorded. Great trading!
          </p>
        ) : (
          <div className="space-y-3">
            {localMistakes.map((mistake) => (
              <div key={mistake.id} className="flex items-start justify-between p-3 bg-muted/30 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge 
                      variant={getSeverityColor(mistake.severity)}
                      className="flex items-center gap-1"
                    >
                      {getSeverityIcon(mistake.severity)}
                      {mistake.severity}
                    </Badge>
                    <span className="font-medium text-sm">{mistake.mistake_tag}</span>
                  </div>
                  {mistake.description && (
                    <p className="text-xs text-muted-foreground">{mistake.description}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMistake(mistake.id)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MistakesManager;