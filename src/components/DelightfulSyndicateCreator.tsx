"use client";
import { useState, useEffect } from "react";
import { X, Users, Heart, Sparkles, Target, Share2, Copy, Check, Eye } from "lucide-react";
import DelightfulButton from "./DelightfulButton";
import SyndicateStepIndicator from "./SyndicateStepIndicator";
import SyndicatePreview from "./SyndicatePreview";

interface SyndicateCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (syndicate: NewSyndicate) => void;
}

interface NewSyndicate {
  name: string;
  description: string;
  cause: string;
  causePercentage: number;
  maxMembers: number;
  minTicketsPerMember: number;
}

const AVAILABLE_CAUSES = [
  { id: "ocean-cleanup", name: "Ocean Cleanup", description: "Remove plastic waste from oceans", emoji: "🌊" },
  { id: "food-security", name: "Food Security", description: "Provide meals to those in need", emoji: "🍽️" },
  { id: "education", name: "Education Access", description: "Support education in underserved communities", emoji: "📚" },
  { id: "climate-action", name: "Climate Action", description: "Fund renewable energy projects", emoji: "🌱" },
  { id: "healthcare", name: "Healthcare Access", description: "Provide medical care to remote areas", emoji: "🏥" },
  { id: "custom", name: "Custom Cause", description: "Define your own cause", emoji: "✨" }
];

export default function DelightfulSyndicateCreator({ isOpen, onClose, onCreate }: SyndicateCreatorProps) {
  const [formData, setFormData] = useState<NewSyndicate>({
    name: "",
    description: "",
    cause: "",
    causePercentage: 20,
    maxMembers: 50,
    minTicketsPerMember: 1
  });
  
  const [customCause, setCustomCause] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentStep, setCurrentStep] = useState<'basic' | 'cause' | 'config' | 'preview'>('basic');
  const [isCreating, setIsCreating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [animateStep, setAnimateStep] = useState(false);
  const [memberPreview, setMemberPreview] = useState<Array<{ id: number; avatar: string; name: string }>>([]);
  const [impactPreview, setImpactPreview] = useState({ totalRaised: 0, causesSupported: 0 });

  // DELIGHT: Generate preview members and impact stats
  useEffect(() => {
    if (formData.maxMembers > 0) {
      const avatars = ['A', 'S', 'J', 'C', 'R', 'M', 'V', 'Q'];
      const names = ['Alex', 'Sam', 'Jordan', 'Casey', 'Riley', 'Morgan', 'Avery', 'Quinn'];
      
      const previewMembers = Array.from({ length: Math.min(8, formData.maxMembers) }, (_, i) => ({
        id: i,
        avatar: avatars[i % avatars.length],
        name: names[i % names.length]
      }));
      setMemberPreview(previewMembers);
      
      // Calculate potential impact
      const avgTicketsPerMember = formData.minTicketsPerMember * 2;
      const totalTickets = formData.maxMembers * avgTicketsPerMember;
      const estimatedRaised = totalTickets * 1;
      const causeAmount = (estimatedRaised * formData.causePercentage) / 100;
      
      setImpactPreview({
        totalRaised: causeAmount,
        causesSupported: 1
      });
    }
  }, [formData.maxMembers, formData.minTicketsPerMember, formData.causePercentage]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) newErrors.name = "Syndicate name is required";
    if (!formData.description.trim()) newErrors.description = "Description is required";
    if (!formData.cause) newErrors.cause = "Please select a cause";
    if (formData.cause === "custom" && !customCause.trim()) {
      newErrors.customCause = "Custom cause description is required";
    }
    if (formData.causePercentage < 5 || formData.causePercentage > 50) {
      newErrors.causePercentage = "Cause percentage must be between 5% and 50%";
    }
    if (formData.maxMembers < 2 || formData.maxMembers > 1000) {
      newErrors.maxMembers = "Max members must be between 2 and 1000";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      setIsCreating(true);
      
      // DELIGHT: Simulate creation process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const syndicateData = {
        ...formData,
        cause: formData.cause === "custom" ? customCause : formData.cause
      };
      
      setIsCreating(false);
      setShowSuccess(true);
      
      // Show success for a moment before closing
      setTimeout(() => {
        onCreate(syndicateData);
        onClose();
        resetForm();
      }, 3000);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      cause: "",
      causePercentage: 20,
      maxMembers: 50,
      minTicketsPerMember: 1
    });
    setCustomCause("");
    setCurrentStep('basic');
    setShowSuccess(false);
    setIsCreating(false);
  };

  const nextStep = () => {
    setAnimateStep(true);
    setTimeout(() => {
      const steps = ['basic', 'cause', 'config', 'preview'] as const;
      const currentIndex = steps.indexOf(currentStep);
      if (currentIndex < steps.length - 1) {
        setCurrentStep(steps[currentIndex + 1]);
      }
      setAnimateStep(false);
    }, 150);
  };

  const prevStep = () => {
    setAnimateStep(true);
    setTimeout(() => {
      const steps = ['basic', 'cause', 'config', 'preview'] as const;
      const currentIndex = steps.indexOf(currentStep);
      if (currentIndex > 0) {
        setCurrentStep(steps[currentIndex - 1]);
      }
      setAnimateStep(false);
    }, 150);
  };

  if (!isOpen) return null;

  // DELIGHT: Success animation
  if (showSuccess) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-gradient-to-br from-green-900 to-emerald-900 rounded-2xl p-8 max-w-md w-full text-center border border-green-500/30 animate-scale-in">
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-4">Syndicate Created!</h3>
          <p className="text-green-200 mb-6">
            "{formData.name}" is ready to change the world! Share with friends to start building your team.
          </p>
          <div className="flex items-center justify-center gap-2 text-green-300">
            <Users className="w-5 h-5" />
            <span>Building community for {formData.cause}</span>
          </div>
        </div>
      </div>
    );
  }

  // DELIGHT: Creation loading animation
  if (isCreating) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full text-center border border-purple-500/30">
          <div className="animate-spin w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-6"></div>
          <h3 className="text-xl font-bold text-white mb-4">Creating Your Syndicate...</h3>
          <div className="space-y-2 text-gray-300">
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></div>
              <span>Setting up cause allocation</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              <span>Configuring member settings</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
              <span>Preparing for launch</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 'basic':
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Users className="w-12 h-12 text-purple-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Let's start with the basics</h3>
              <p className="text-gray-400">Give your syndicate a name and describe your mission</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Syndicate Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-4 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none transition-colors"
                placeholder="e.g., Ocean Warriors Collective"
              />
              {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="w-full p-4 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none transition-colors"
                placeholder="Describe your syndicate's mission and goals..."
              />
              {errors.description && <p className="text-red-400 text-sm mt-1">{errors.description}</p>}
            </div>
          </div>
        );

      case 'cause':
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Heart className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Choose your cause</h3>
              <p className="text-gray-400">Select what cause your syndicate will support</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {AVAILABLE_CAUSES.map((cause) => (
                <div
                  key={cause.id}
                  onClick={() => setFormData({ ...formData, cause: cause.id })}
                  className={`p-4 rounded-lg border cursor-pointer transition-all transform hover:scale-105 ${
                    formData.cause === cause.id
                      ? "border-green-500 bg-green-500/20 scale-105"
                      : "border-gray-600 bg-gray-700/50 hover:border-gray-500"
                  }`}
                >
                  <div className="text-2xl mb-2">{cause.emoji}</div>
                  <h4 className="font-semibold text-white">{cause.name}</h4>
                  <p className="text-gray-400 text-sm">{cause.description}</p>
                </div>
              ))}
            </div>
            {errors.cause && <p className="text-red-400 text-sm mt-1">{errors.cause}</p>}

            {formData.cause === "custom" && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Custom Cause Description *
                </label>
                <input
                  type="text"
                  value={customCause}
                  onChange={(e) => setCustomCause(e.target.value)}
                  className="w-full p-4 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none transition-colors"
                  placeholder="Describe your custom cause..."
                />
                {errors.customCause && <p className="text-red-400 text-sm mt-1">{errors.customCause}</p>}
              </div>
            )}
          </div>
        );

      case 'config':
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Target className="w-12 h-12 text-blue-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Configure your syndicate</h3>
              <p className="text-gray-400">Set up member limits and cause allocation</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Cause Allocation (% of winnings)
                </label>
                <input
                  type="range"
                  min="5"
                  max="50"
                  value={formData.causePercentage}
                  onChange={(e) => setFormData({ ...formData, causePercentage: parseInt(e.target.value) })}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-sm text-gray-400 mt-1">
                  <span>5%</span>
                  <span className="text-white font-bold">{formData.causePercentage}%</span>
                  <span>50%</span>
                </div>
                {errors.causePercentage && <p className="text-red-400 text-sm mt-1">{errors.causePercentage}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Maximum Members
                </label>
                <input
                  type="number"
                  min="2"
                  max="1000"
                  value={formData.maxMembers}
                  onChange={(e) => setFormData({ ...formData, maxMembers: parseInt(e.target.value) || 50 })}
                  className="w-full p-4 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none transition-colors"
                />
                {errors.maxMembers && <p className="text-red-400 text-sm mt-1">{errors.maxMembers}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Minimum Tickets per Member
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={formData.minTicketsPerMember}
                onChange={(e) => setFormData({ ...formData, minTicketsPerMember: parseInt(e.target.value) || 1 })}
                className="w-full p-4 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none transition-colors"
              />
            </div>
          </div>
        );

      case 'preview':
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Eye className="w-12 h-12 text-green-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Preview your syndicate</h3>
              <p className="text-gray-400">Review everything before creating</p>
            </div>
            
            <SyndicatePreview 
              formData={formData}
              memberPreview={memberPreview}
              impactPreview={impactPreview}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-700 shadow-2xl">
        {/* Header with Step Indicator */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Create New Syndicate</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-700 rounded-lg"
            >
              <X size={24} />
            </button>
          </div>
          
          <SyndicateStepIndicator currentStep={currentStep} />
        </div>

        {/* Step Content */}
        <div className={`p-6 transition-all duration-300 ${animateStep ? 'opacity-50 scale-95' : 'opacity-100 scale-100'}`}>
          {renderStepContent()}
        </div>

        {/* Navigation */}
        <div className="p-6 border-t border-gray-700 flex justify-between">
          <DelightfulButton
            onClick={prevStep}
            disabled={currentStep === 'basic'}
            variant="secondary"
          >
            Previous
          </DelightfulButton>

          {currentStep === 'preview' ? (
            <DelightfulButton
              onClick={handleSubmit}
              variant="success"
              loading={isCreating}
            >
              Create Syndicate
            </DelightfulButton>
          ) : (
            <DelightfulButton
              onClick={nextStep}
              variant="primary"
            >
              Next
            </DelightfulButton>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes scale-in {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-scale-in {
          animation: scale-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}