"use client";
import { useState } from "react";
import { X } from "lucide-react";

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
  { id: "ocean-cleanup", name: "Ocean Cleanup", description: "Remove plastic waste from oceans" },
  { id: "food-security", name: "Food Security", description: "Provide meals to those in need" },
  { id: "education", name: "Education Access", description: "Support education in underserved communities" },
  { id: "climate-action", name: "Climate Action", description: "Fund renewable energy projects" },
  { id: "healthcare", name: "Healthcare Access", description: "Provide medical care to remote areas" },
  { id: "custom", name: "Custom Cause", description: "Define your own cause" }
];

export default function SyndicateCreator({ isOpen, onClose, onCreate }: SyndicateCreatorProps) {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      const syndicateData = {
        ...formData,
        cause: formData.cause === "custom" ? customCause : formData.cause
      };
      onCreate(syndicateData);
      onClose();
      // Reset form
      setFormData({
        name: "",
        description: "",
        cause: "",
        causePercentage: 20,
        maxMembers: 50,
        minTicketsPerMember: 1
      });
      setCustomCause("");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-white">Create New Syndicate</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Basic Information</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Syndicate Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
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
                rows={3}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                placeholder="Describe your syndicate's mission and goals..."
              />
              {errors.description && <p className="text-red-400 text-sm mt-1">{errors.description}</p>}
            </div>
          </div>

          {/* Cause Selection */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Cause Selection</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {AVAILABLE_CAUSES.map((cause) => (
                <div
                  key={cause.id}
                  onClick={() => setFormData({ ...formData, cause: cause.id })}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    formData.cause === cause.id
                      ? "border-green-500 bg-green-500/20"
                      : "border-gray-600 bg-gray-700/50 hover:border-gray-500"
                  }`}
                >
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
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                  placeholder="Describe your custom cause..."
                />
                {errors.customCause && <p className="text-red-400 text-sm mt-1">{errors.customCause}</p>}
              </div>
            )}
          </div>

          {/* Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Configuration</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Cause Allocation (% of winnings)
                </label>
                <input
                  type="number"
                  min="5"
                  max="50"
                  value={formData.causePercentage}
                  onChange={(e) => setFormData({ ...formData, causePercentage: parseInt(e.target.value) || 20 })}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                />
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
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
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
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Summary */}
          <div className="bg-gray-700/50 rounded-lg p-4">
            <h4 className="font-semibold text-white mb-2">Summary</h4>
            <div className="space-y-1 text-sm text-gray-300">
              <div>• {formData.causePercentage}% of winnings go to your selected cause</div>
              <div>• {100 - formData.causePercentage}% distributed among {formData.maxMembers} members</div>
              <div>• Each member must purchase at least {formData.minTicketsPerMember} ticket(s)</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg transition-all"
            >
              Create Syndicate
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
