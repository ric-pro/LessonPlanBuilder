// Lesson Plan Generator JavaScript

class LessonPlanGenerator {
    constructor() {
        this.form = document.getElementById('lessonForm');
        this.generateBtn = document.getElementById('generateBtn');
        this.previewContent = document.getElementById('previewContent');
        this.exportOptions = document.getElementById('exportOptions');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.progressFill = document.getElementById('progressFill');
        
        this.initializeEventListeners();
        this.initializeFormValidation();
    }

    initializeEventListeners() {
        // Form submission
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.generateLessonPlan();
        });

        // Export buttons
        document.getElementById('exportPdf').addEventListener('click', () => {
            this.exportToPDF();
        });

        document.getElementById('exportWord').addEventListener('click', () => {
            this.exportToWord();
        });

        // Form field changes for dynamic updates
        this.form.addEventListener('change', () => {
            this.updateFormState();
        });

        // Input field animations
        const inputs = document.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.addEventListener('focus', (e) => {
                e.target.parentElement.classList.add('focused');
            });
            
            input.addEventListener('blur', (e) => {
                e.target.parentElement.classList.remove('focused');
            });
        });
    }

    initializeFormValidation() {
        const requiredFields = document.querySelectorAll('[required]');
        requiredFields.forEach(field => {
            field.addEventListener('blur', () => {
                this.validateField(field);
            });
        });
    }

    validateField(field) {
        const isValid = field.checkValidity();
        const formGroup = field.parentElement;
        
        formGroup.classList.remove('error', 'success');
        
        if (field.value.trim() !== '') {
            if (isValid) {
                formGroup.classList.add('success');
            } else {
                formGroup.classList.add('error');
            }
        }
    }

    updateFormState() {
        const formData = new FormData(this.form);
        const requiredFields = ['subject', 'focusTopic', 'bloomsLevel', 'aqfLevel', 'duration', 'assessmentType'];
        
        const allFieldsFilled = requiredFields.every(field => {
            const value = formData.get(field);
            return value && value.trim() !== '';
        });

        this.generateBtn.disabled = !allFieldsFilled;
        
        if (allFieldsFilled) {
            this.generateBtn.classList.add('ready');
        } else {
            this.generateBtn.classList.remove('ready');
        }
    }

    async generateLessonPlan() {
        const formData = new FormData(this.form);
        const lessonData = {
            subject: formData.get('subject'),
            focusTopic: formData.get('focusTopic'),
            bloomsLevel: formData.get('bloomsLevel'),
            aqfLevel: formData.get('aqfLevel'),
            duration: formData.get('duration'),
            assessmentType: formData.get('assessmentType'),
            additionalRequirements: formData.get('additionalRequirements')
        };

        this.showLoading();
        
        try {
            // Simulate API call with realistic delay
            await this.simulateGeneration();
            
            const lessonPlan = this.createMockLessonPlan(lessonData);
            this.displayLessonPlan(lessonPlan);
            this.showExportOptions();
            
        } catch (error) {
            console.error('Error generating lesson plan:', error);
            this.showError('Failed to generate lesson plan. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    async simulateGeneration() {
        // Simulate realistic generation time (2-3 minutes as per requirements)
        const steps = [
            { message: 'Analyzing curriculum requirements...', duration: 800 },
            { message: 'Retrieving relevant educational content...', duration: 1000 },
            { message: 'Processing learning objectives...', duration: 700 },
            { message: 'Generating lesson structure...', duration: 900 },
            { message: 'Creating assessment activities...', duration: 600 },
            { message: 'Finalizing lesson plan...', duration: 500 }
        ];

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            this.updateLoadingMessage(step.message);
            this.updateProgress((i + 1) / steps.length * 100);
            await this.delay(step.duration);
        }
    }

    createMockLessonPlan(data) {
        const subjectNames = {
            'intro-it': 'Introduction to Information Technology',
            'intro-data-science': 'Introduction to Data Science',
            'intro-statistics': 'Introduction to Statistics'
        };

        const bloomsDescriptions = {
            'remember': 'Students will recall and recognize key concepts',
            'understand': 'Students will explain and interpret information',
            'apply': 'Students will use knowledge in practical situations',
            'analyze': 'Students will examine and break down complex ideas',
            'evaluate': 'Students will assess and critique information',
            'create': 'Students will design and produce original work'
        };

        return {
            title: `${subjectNames[data.subject]}: ${data.focusTopic}`,
            duration: `${data.duration} minutes`,
            aqfLevel: data.aqfLevel.toUpperCase(),
            bloomsLevel: data.bloomsLevel,
            assessmentType: data.assessmentType,
            learningObjectives: this.generateLearningObjectives(data),
            lessonStructure: this.generateLessonStructure(data),
            activities: this.generateActivities(data),
            assessment: this.generateAssessment(data),
            resources: this.generateResources(data),
            additionalNotes: data.additionalRequirements || 'No additional requirements specified.'
        };
    }

    generateLearningObjectives(data) {
        const objectives = [
            `By the end of this lesson, students will be able to demonstrate understanding of ${data.focusTopic} concepts at the ${data.bloomsLevel} level.`,
            `Students will apply theoretical knowledge to practical scenarios related to ${data.focusTopic}.`,
            `Students will critically evaluate different approaches and methodologies within the context of ${data.focusTopic}.`
        ];

        if (data.subject === 'intro-data-science') {
            objectives.push('Students will demonstrate proficiency in data analysis techniques and interpretation.');
        } else if (data.subject === 'intro-statistics') {
            objectives.push('Students will apply statistical methods to solve real-world problems.');
        } else if (data.subject === 'intro-it') {
            objectives.push('Students will understand fundamental IT concepts and their practical applications.');
        }

        return objectives;
    }

    generateLessonStructure(data) {
        const duration = parseInt(data.duration);
        const structure = [];

        // Introduction (10-15% of total time)
        const introTime = Math.round(duration * 0.125);
        structure.push({
            phase: 'Introduction & Review',
            duration: `${introTime} minutes`,
            activities: [
                'Welcome and attendance',
                'Review of previous lesson concepts',
                'Introduction to today\'s topic',
                'Learning objectives overview'
            ]
        });

        // Main Content (60-70% of total time)
        const mainTime = Math.round(duration * 0.65);
        structure.push({
            phase: 'Main Content Delivery',
            duration: `${mainTime} minutes`,
            activities: [
                `Theoretical foundation of ${data.focusTopic}`,
                'Interactive demonstrations and examples',
                'Guided practice activities',
                'Q&A and discussion sessions'
            ]
        });

        // Practice/Application (15-20% of total time)
        const practiceTime = Math.round(duration * 0.175);
        structure.push({
            phase: 'Practical Application',
            duration: `${practiceTime} minutes`,
            activities: [
                'Hands-on exercises',
                'Group work and collaboration',
                'Individual practice time',
                'Peer feedback sessions'
            ]
        });

        // Conclusion (5-10% of total time)
        const conclusionTime = duration - introTime - mainTime - practiceTime;
        structure.push({
            phase: 'Conclusion & Assessment',
            duration: `${conclusionTime} minutes`,
            activities: [
                'Summary of key concepts',
                'Assessment activity',
                'Next lesson preview',
                'Assignment instructions'
            ]
        });

        return structure;
    }

    generateActivities(data) {
        const activities = [];

        if (data.subject === 'intro-data-science') {
            activities.push(
                'Data exploration using sample datasets',
                'Visualization creation and interpretation',
                'Statistical analysis exercises',
                'Case study analysis and presentation'
            );
        } else if (data.subject === 'intro-statistics') {
            activities.push(
                'Statistical calculation exercises',
                'Hypothesis testing scenarios',
                'Data interpretation challenges',
                'Real-world problem solving'
            );
        } else if (data.subject === 'intro-it') {
            activities.push(
                'Technology demonstration and exploration',
                'System analysis and design exercises',
                'Problem-solving scenarios',
                'Technology evaluation activities'
            );
        }

        // Add Bloom's taxonomy specific activities
        if (data.bloomsLevel === 'create') {
            activities.push('Design and create original solutions');
        } else if (data.bloomsLevel === 'evaluate') {
            activities.push('Critical evaluation and comparison tasks');
        } else if (data.bloomsLevel === 'analyze') {
            activities.push('Analysis and breakdown of complex concepts');
        }

        return activities;
    }

    generateAssessment(data) {
        const assessmentMethods = {
            'formative': [
                'Regular check-in questions during the lesson',
                'Exit tickets with key concept questions',
                'Peer discussion and feedback',
                'Quick polls and quizzes'
            ],
            'summative': [
                'End-of-lesson comprehensive quiz',
                'Practical project or assignment',
                'Written reflection on learning outcomes',
                'Performance-based assessment'
            ],
            'peer': [
                'Peer review of practical exercises',
                'Group presentation evaluations',
                'Collaborative assessment activities',
                'Peer feedback sessions'
            ],
            'self': [
                'Self-reflection questionnaires',
                'Learning journal entries',
                'Self-assessment rubrics',
                'Goal-setting activities'
            ],
            'mixed': [
                'Combination of formative and summative methods',
                'Peer and self-assessment components',
                'Multiple assessment touchpoints',
                'Varied assessment formats'
            ]
        };

        return {
            type: data.assessmentType,
            methods: assessmentMethods[data.assessmentType] || assessmentMethods['mixed'],
            criteria: [
                'Understanding of core concepts',
                'Application of knowledge to practical scenarios',
                'Critical thinking and analysis skills',
                'Communication and presentation abilities'
            ]
        };
    }

    generateResources(data) {
        const commonResources = [
            'University of Canberra Learning Management System',
            'Prescribed textbooks and readings',
            'Online databases and academic journals',
            'Interactive learning platforms'
        ];

        const subjectSpecificResources = {
            'intro-data-science': [
                'Python/R programming environments',
                'Data visualization tools (Tableau, Power BI)',
                'Sample datasets for analysis',
                'Statistical software packages'
            ],
            'intro-statistics': [
                'Statistical software (SPSS, R, Excel)',
                'Calculator and statistical tables',
                'Real-world data sources',
                'Statistical analysis templates'
            ],
            'intro-it': [
                'Computer lab access',
                'Software demonstration tools',
                'Technology case studies',
                'Industry reports and whitepapers'
            ]
        };

        return [
            ...commonResources,
            ...(subjectSpecificResources[data.subject] || [])
        ];
    }

    displayLessonPlan(lessonPlan) {
        const content = `
            <div class="lesson-plan-content fade-in">
                <div class="lesson-header">
                    <h3>${lessonPlan.title}</h3>
                    <div class="lesson-meta">
                        <span><strong>Duration:</strong> ${lessonPlan.duration}</span>
                        <span><strong>AQF Level:</strong> ${lessonPlan.aqfLevel}</span>
                        <span><strong>Bloom's Level:</strong> ${lessonPlan.bloomsLevel}</span>
                    </div>
                </div>

                <div class="lesson-section">
                    <h4><i class="fas fa-bullseye"></i> Learning Objectives</h4>
                    <ul>
                        ${lessonPlan.learningObjectives.map(obj => `<li>${obj}</li>`).join('')}
                    </ul>
                </div>

                <div class="lesson-section">
                    <h4><i class="fas fa-clock"></i> Lesson Structure</h4>
                    ${lessonPlan.lessonStructure.map(phase => `
                        <div class="phase-block">
                            <h5>${phase.phase} (${phase.duration})</h5>
                            <ul>
                                ${phase.activities.map(activity => `<li>${activity}</li>`).join('')}
                            </ul>
                        </div>
                    `).join('')}
                </div>

                <div class="lesson-section">
                    <h4><i class="fas fa-tasks"></i> Learning Activities</h4>
                    <ul>
                        ${lessonPlan.activities.map(activity => `<li>${activity}</li>`).join('')}
                    </ul>
                </div>

                <div class="lesson-section">
                    <h4><i class="fas fa-clipboard-check"></i> Assessment</h4>
                    <p><strong>Assessment Type:</strong> ${lessonPlan.assessment.type}</p>
                    <p><strong>Methods:</strong></p>
                    <ul>
                        ${lessonPlan.assessment.methods.map(method => `<li>${method}</li>`).join('')}
                    </ul>
                    <p><strong>Assessment Criteria:</strong></p>
                    <ul>
                        ${lessonPlan.assessment.criteria.map(criteria => `<li>${criteria}</li>`).join('')}
                    </ul>
                </div>

                <div class="lesson-section">
                    <h4><i class="fas fa-book"></i> Required Resources</h4>
                    <ul>
                        ${lessonPlan.resources.map(resource => `<li>${resource}</li>`).join('')}
                    </ul>
                </div>

                <div class="lesson-section">
                    <h4><i class="fas fa-sticky-note"></i> Additional Notes</h4>
                    <p>${lessonPlan.additionalNotes}</p>
                </div>
            </div>
        `;

        this.previewContent.innerHTML = content;
        this.previewContent.scrollIntoView({ behavior: 'smooth' });
    }

    showExportOptions() {
        this.exportOptions.style.display = 'block';
        this.exportOptions.classList.add('slide-up');
    }

    showLoading() {
        this.loadingOverlay.style.display = 'flex';
        this.generateBtn.disabled = true;
        this.updateProgress(0);
    }

    hideLoading() {
        this.loadingOverlay.style.display = 'none';
        this.generateBtn.disabled = false;
    }

    updateLoadingMessage(message) {
        const loadingText = document.querySelector('.loading-content p');
        if (loadingText) {
            loadingText.textContent = message;
        }
    }

    updateProgress(percentage) {
        this.progressFill.style.width = `${percentage}%`;
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <div class="error-content">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Generation Error</h3>
                <p>${message}</p>
                <button onclick="this.parentElement.parentElement.remove()">Close</button>
            </div>
        `;
        document.body.appendChild(errorDiv);
    }

    async exportToPDF() {
        this.showNotification('PDF export functionality would be implemented with backend integration.', 'info');
    }

    async exportToWord() {
        this.showNotification('Word export functionality would be implemented with backend integration.', 'info');
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'}"></i>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Additional CSS for dynamic elements
const additionalStyles = `
    .lesson-meta {
        display: flex;
        gap: 20px;
        margin: 15px 0;
        padding: 15px;
        background: #f8fafc;
        border-radius: 8px;
        font-size: 0.9rem;
    }

    .lesson-section {
        margin: 25px 0;
        padding: 20px;
        border-left: 4px solid #667eea;
        background: #f8fafc;
        border-radius: 0 8px 8px 0;
    }

    .lesson-section h4 {
        color: #2d3748;
        margin-bottom: 15px;
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .lesson-section h4 i {
        color: #667eea;
    }

    .phase-block {
        margin: 15px 0;
        padding: 15px;
        background: white;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
    }

    .phase-block h5 {
        color: #4a5568;
        margin-bottom: 10px;
        font-size: 1rem;
    }

    .form-group.focused {
        transform: translateY(-2px);
    }

    .form-group.success input,
    .form-group.success select,
    .form-group.success textarea {
        border-color: #48bb78;
        box-shadow: 0 0 0 3px rgba(72, 187, 120, 0.1);
    }

    .form-group.error input,
    .form-group.error select,
    .form-group.error textarea {
        border-color: #f56565;
        box-shadow: 0 0 0 3px rgba(245, 101, 101, 0.1);
    }

    .generate-btn.ready {
        animation: pulse 2s infinite;
    }

    @keyframes pulse {
        0% { box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4); }
        50% { box-shadow: 0 4px 25px rgba(102, 126, 234, 0.6); }
        100% { box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4); }
    }

    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        padding: 15px 20px;
        border-radius: 10px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        z-index: 1001;
        animation: slideInRight 0.3s ease-out;
    }

    .notification.success {
        border-left: 4px solid #48bb78;
    }

    .notification.info {
        border-left: 4px solid #4299e1;
    }

    .notification-content {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .notification-content i {
        color: #48bb78;
    }

    .notification.info .notification-content i {
        color: #4299e1;
    }

    .notification-content button {
        background: none;
        border: none;
        font-size: 1.2rem;
        cursor: pointer;
        color: #a0aec0;
        margin-left: 10px;
    }

    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }

    .error-message {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1002;
    }

    .error-content {
        background: white;
        padding: 30px;
        border-radius: 15px;
        text-align: center;
        max-width: 400px;
        width: 90%;
    }

    .error-content i {
        font-size: 3rem;
        color: #f56565;
        margin-bottom: 15px;
    }

    .error-content button {
        background: #f56565;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 8px;
        cursor: pointer;
        margin-top: 15px;
    }
`;

// Add additional styles to the page
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new LessonPlanGenerator();
    
    // Add some interactive enhancements
    setTimeout(() => {
        document.body.classList.add('loaded');
    }, 100);
});

// Add smooth scrolling for better UX
document.documentElement.style.scrollBehavior = 'smooth';

