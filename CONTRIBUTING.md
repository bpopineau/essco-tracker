# Contributing to ESSCO Project Tracker

Thank you for your interest in contributing to the ESSCO Project Tracker! This guide will help you get started and work effectively with our Copilot coding agent.

## 🤖 Working with GitHub Copilot Coding Agent

This repository is configured to work with GitHub Copilot coding agent for enhanced development collaboration. The agent can help with:

- **Code Reviews**: Automated analysis of pull requests
- **Bug Fixes**: Assistance in identifying and resolving issues  
- **Feature Development**: Support for implementing new functionality
- **Documentation**: Help with updating and maintaining docs
- **Testing**: Suggestions for test cases and validation

### Interacting with the Copilot Agent

When creating issues or pull requests, you can engage with the Copilot agent by:

1. **Use descriptive titles** that clearly explain the problem or feature
2. **Provide detailed descriptions** with context about the issue
3. **Include relevant code snippets** when reporting bugs
4. **Tag issues appropriately** using our issue templates
5. **Reference related issues** using `#issue-number` syntax

## 🚀 Getting Started

### Prerequisites

- Modern web browser (Chrome, Edge, Firefox, or Safari)
- Basic knowledge of HTML, CSS, and JavaScript
- Text editor or IDE

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/yourusername/essco-tracker.git
   cd essco-tracker
   ```

2. **Open in Browser**
   ```bash
   # Start a local server (optional, but recommended)
   python3 -m http.server 8000
   # Then open http://localhost:8000 in your browser
   ```

3. **Or simply open `index.html`** directly in your browser

### Project Architecture

- **Frontend-only**: 100% client-side, no server required
- **ES Modules**: Modern JavaScript with native module loading
- **PWA**: Progressive Web App with offline capabilities
- **Local Storage**: Data persisted in browser's localStorage/IndexedDB
- **No Build Process**: Direct development without compilation

## 📝 How to Contribute

### 1. Creating Issues

Use our issue templates for:
- **🐛 Bug Reports**: Report problems or unexpected behavior
- **✨ Feature Requests**: Suggest new functionality
- **🤖 Copilot Tasks**: Request assistance from the coding agent

### 2. Pull Requests

1. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** with clear, focused commits
3. **Test thoroughly** in multiple browsers (Chrome, Edge recommended)
4. **Follow our PR template** when submitting
5. **Engage with code reviews** and address feedback promptly

### 3. Code Standards

- **ES6+ JavaScript**: Use modern syntax and features
- **Semantic HTML**: Accessible and well-structured markup
- **CSS Custom Properties**: Use CSS variables for theming
- **No External Dependencies**: Keep the project dependency-free
- **Progressive Enhancement**: Ensure core functionality works everywhere

### 4. Testing

- Test in **Chrome/Edge** (primary browsers)
- Test **offline functionality** (PWA features)
- Verify **localStorage persistence** works
- Test on **different screen sizes** (responsive design)
- Validate **keyboard navigation** (accessibility)

## 🎯 Areas for Contribution

### High Priority
- **Accessibility improvements** (ARIA labels, keyboard navigation)
- **Mobile experience enhancements** (touch interactions)
- **Performance optimizations** (faster loading, smoother animations)
- **Browser compatibility** (especially Safari and Firefox)

### Medium Priority  
- **New features** (see open feature request issues)
- **UI/UX improvements** (better visual design, user experience)
- **Documentation updates** (help text, user guides)

### Lower Priority
- **Code refactoring** (cleaner, more maintainable code)
- **Advanced features** (data import/export formats, integrations)

## 💬 Communication

- **Issues**: For bug reports, feature requests, and discussions
- **Pull Requests**: For code changes and improvements
- **Copilot Agent**: Available to help with technical questions and code review

## 🔧 Troubleshooting

### Common Issues

**Data not saving?**
- Check if localStorage is enabled in browser settings
- Verify you're not in incognito/private mode

**App not updating?**  
- Hard refresh (Ctrl/Cmd + Shift + R)
- Clear browser cache for the site

**Features not working?**
- Use Chrome or Edge for best compatibility
- Check browser console for error messages

## 📋 Code of Conduct

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) to understand the standards we expect from all contributors.

## 📄 License

By contributing to this project, you agree that your contributions will be licensed under the MIT License.

---

**Questions?** Feel free to open an issue or start a discussion. Our Copilot coding agent is also available to help with technical questions!