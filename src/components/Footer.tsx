import React from 'react';
import { Bot, Heart } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200 mt-20 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <img 
                src="https://drive.google.com/thumbnail?id=1IrQAzr2JXZjfhDxPhP-MZkFlbF8GfW9n&sz=w1000" 
                alt="Hamster English Logo"
                className="w-10 h-10 rounded-xl object-cover shadow-sm"
                referrerPolicy="no-referrer"
              />
              <span className="font-display font-bold text-xl tracking-tight text-slate-800">
                Hamster English <span className="text-brand-purple">- ESL Studio</span>
              </span>
            </div>
            <p className="text-slate-500 max-w-sm mb-6">
              Empowering language teachers worldwide with AI-generated premium educational games and resources.
            </p>
            <div className="flex gap-4">
              {/* Social icons would go here */}
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-brand-purple hover:text-white transition-colors cursor-pointer">
                <span className="font-bold">X</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-brand-purple hover:text-white transition-colors cursor-pointer">
                <span className="font-bold">in</span>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="font-bold text-slate-900 mb-4">Platform</h4>
            <ul className="space-y-3 text-sm text-slate-500">
              <li><a href="#" className="hover:text-brand-purple transition-colors">Games Library</a></li>
              <li><a href="#" className="hover:text-brand-purple transition-colors">AI Generator</a></li>
              <li><a href="#" className="hover:text-brand-purple transition-colors">Pricing</a></li>
              <li><a href="#" className="hover:text-brand-purple transition-colors">For Schools</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold text-slate-900 mb-4">Resources</h4>
            <ul className="space-y-3 text-sm text-slate-500">
              <li><a href="#" className="hover:text-brand-purple transition-colors">Help Center</a></li>
              <li><a href="#" className="hover:text-brand-purple transition-colors">Teacher Community</a></li>
              <li><a href="#" className="hover:text-brand-purple transition-colors">Blog</a></li>
              <li><a href="#" className="hover:text-brand-purple transition-colors">Webinars</a></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-slate-100 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-400">
          <p>© 2026 Hamster English - ESL Studio. All rights reserved.</p>
          <p className="flex items-center gap-1">
            Created by Teacher Jan <Heart size={14} className="text-brand-orange" /> for Teachers
          </p>
        </div>
      </div>
    </footer>
  );
}
