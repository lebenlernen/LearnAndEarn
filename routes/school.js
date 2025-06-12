const express = require('express');
const router = express.Router();
const { isAuthenticated, isTeacher } = require('../middleware/auth');

// Check if student has any class enrollments
router.get('/my-enrollment-status', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId || req.user?.id;
        
        const result = await req.db.query(`
            SELECT COUNT(*) as count
            FROM our_class_members
            WHERE student_id = $1
        `, [userId]);
        
        const hasClasses = parseInt(result.rows[0].count) > 0;
        
        res.json({ hasClasses });
    } catch (error) {
        console.error('Error checking enrollment status:', error);
        res.status(500).json({ error: 'Failed to check enrollment status' });
    }
});

// Get user's school info
router.get('/info', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId || req.user?.id;
        const isTeacher = req.session.is_teacher;
        
        // For students, only show their enrolled classes and related info
        if (!isTeacher) {
            const userQuery = await req.db.query(`
                SELECT id, email, username, timezone
                FROM our_users
                WHERE id = $1
            `, [userId]);
            
            if (userQuery.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            const userData = userQuery.rows[0];
            
            // Get only enrolled classes
            const classesQuery = await req.db.query(`
                SELECT c.id, c.name, c.description, c.created_at,
                       u.username as teacher_name
                FROM our_classes c
                JOIN our_class_members cm ON c.id = cm.class_id
                JOIN our_users u ON c.teacher_id = u.id
                WHERE cm.student_id = $1
                ORDER BY c.created_at DESC
            `, [userId]);
            
            res.json({
                user: userData,
                classes: classesQuery.rows
            });
        } else {
            // Teachers see full school info
            const userQuery = await req.db.query(`
                SELECT 
                    u.id, u.email, u.username, u.is_teacher, u.timezone,
                    s.id as school_id, s.name as school_name
                FROM our_users u
                LEFT JOIN our_schools s ON u.school_id = s.id
                WHERE u.id = $1
            `, [userId]);
        
        if (userQuery.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const userData = userQuery.rows[0];
        
        // Get classes for teachers or enrolled classes for students
        let classes = [];
        if (userData.is_teacher) {
            const classesQuery = await req.db.query(`
                SELECT id, name, description, created_at
                FROM our_classes
                WHERE teacher_id = $1
                ORDER BY created_at DESC
            `, [userId]);
            classes = classesQuery.rows;
        } else {
            const classesQuery = await req.db.query(`
                SELECT c.id, c.name, c.description, c.created_at,
                       u.username as teacher_name
                FROM our_classes c
                JOIN our_class_members cm ON c.id = cm.class_id
                JOIN our_users u ON c.teacher_id = u.id
                WHERE cm.student_id = $1
                ORDER BY c.created_at DESC
            `, [userId]);
            classes = classesQuery.rows;
        }
        
        res.json({
            user: userData,
            classes: classes
        });
        }
    } catch (error) {
        console.error('Error fetching school info:', error);
        res.status(500).json({ error: 'Failed to fetch school info' });
    }
});

// Create a new class (teachers only)
router.post('/classes', isTeacher, async (req, res) => {
    try {
        const { name, description } = req.body;
        const teacherId = req.session.userId || req.user?.id;
        const schoolId = req.session.school_id;
        
        const result = await req.db.query(`
            INSERT INTO our_classes (school_id, teacher_id, name, description)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [schoolId, teacherId, name, description]);
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error creating class:', error);
        res.status(500).json({ error: 'Failed to create class' });
    }
});

// Get class details
router.get('/classes/:classId', isAuthenticated, async (req, res) => {
    try {
        const { classId } = req.params;
        const userId = req.session.userId || req.user?.id;
        
        // Get class info
        const classQuery = await req.db.query(`
            SELECT c.*, u.username as teacher_name
            FROM our_classes c
            JOIN our_users u ON c.teacher_id = u.id
            WHERE c.id = $1
        `, [classId]);
        
        if (classQuery.rows.length === 0) {
            return res.status(404).json({ error: 'Class not found' });
        }
        
        const classData = classQuery.rows[0];
        
        // Check if user has access (is teacher or enrolled student)
        if (classData.teacher_id !== userId) {
            const memberCheck = await req.db.query(`
                SELECT 1 FROM our_class_members
                WHERE class_id = $1 AND student_id = $2
            `, [classId, userId]);
            
            if (memberCheck.rows.length === 0) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }
        
        // Get class members
        const membersQuery = await req.db.query(`
            SELECT u.id, u.username, u.email, cm.joined_at
            FROM our_class_members cm
            JOIN our_users u ON cm.student_id = u.id
            WHERE cm.class_id = $1
            ORDER BY cm.joined_at
        `, [classId]);
        
        res.json({
            class: classData,
            members: membersQuery.rows
        });
    } catch (error) {
        console.error('Error fetching class details:', error);
        res.status(500).json({ error: 'Failed to fetch class details' });
    }
});

// Add students to class
router.post('/classes/:classId/members', isTeacher, async (req, res) => {
    try {
        const { classId } = req.params;
        const { studentIds } = req.body;
        const teacherId = req.session.userId || req.user?.id;
        
        // Verify teacher owns the class
        const classCheck = await req.db.query(
            'SELECT 1 FROM our_classes WHERE id = $1 AND teacher_id = $2',
            [classId, teacherId]
        );
        
        if (classCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Add students
        const values = studentIds.map(studentId => `(${classId}, ${studentId})`).join(',');
        await req.db.query(`
            INSERT INTO our_class_members (class_id, student_id)
            VALUES ${values}
            ON CONFLICT (class_id, student_id) DO NOTHING
        `);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error adding class members:', error);
        res.status(500).json({ error: 'Failed to add class members' });
    }
});

// Create a session
router.post('/sessions', isTeacher, async (req, res) => {
    try {
        const { 
            classId, 
            title, 
            description, 
            scheduledStart, 
            scheduledEnd,
            sessionType = 'class'
        } = req.body;
        const teacherId = req.session.userId || req.user?.id;
        
        const result = await req.db.query(`
            INSERT INTO our_school_sessions 
            (teacher_id, class_id, title, description, scheduled_start, scheduled_end, session_type)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [teacherId, classId, title, description, scheduledStart, scheduledEnd, sessionType]);
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error creating session:', error);
        res.status(500).json({ error: 'Failed to create session' });
    }
});

// Get upcoming sessions
router.get('/sessions/upcoming', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId || req.user?.id;
        const isTeacher = req.session.is_teacher;
        
        let query;
        if (isTeacher) {
            // Get teacher's sessions
            query = `
                SELECT s.*, c.name as class_name
                FROM our_school_sessions s
                LEFT JOIN our_classes c ON s.class_id = c.id
                WHERE s.teacher_id = $1 
                    AND s.scheduled_start > NOW()
                    AND s.status IN ('scheduled', 'active')
                ORDER BY s.scheduled_start
            `;
        } else {
            // Get student's sessions (from enrolled classes and invitations)
            query = `
                SELECT DISTINCT s.*, c.name as class_name, u.username as teacher_name
                FROM our_school_sessions s
                LEFT JOIN our_classes c ON s.class_id = c.id
                JOIN our_users u ON s.teacher_id = u.id
                WHERE s.scheduled_start > NOW()
                    AND s.status IN ('scheduled', 'active')
                    AND (
                        -- Sessions from enrolled classes
                        (s.session_type = 'class' AND EXISTS (
                            SELECT 1 FROM our_class_members cm 
                            WHERE cm.class_id = s.class_id AND cm.student_id = $1
                        ))
                        OR
                        -- Invited sessions
                        EXISTS (
                            SELECT 1 FROM our_session_invitations si
                            WHERE si.session_id = s.id AND si.student_id = $1
                                AND si.response != 'declined'
                        )
                    )
                ORDER BY s.scheduled_start
            `;
        }
        
        const result = await req.db.query(query, [userId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching sessions:', error);
        res.status(500).json({ error: 'Failed to fetch sessions' });
    }
});

// Start a session
router.post('/sessions/:sessionId/start', isTeacher, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const teacherId = req.session.userId || req.user?.id;
        
        // Verify teacher owns the session
        const sessionCheck = await req.db.query(
            'SELECT 1 FROM our_school_sessions WHERE id = $1 AND teacher_id = $2',
            [sessionId, teacherId]
        );
        
        if (sessionCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Update session status
        await req.db.query(`
            UPDATE our_school_sessions 
            SET status = 'active', actual_start = NOW()
            WHERE id = $1
        `, [sessionId]);
        
        // Notify via WebSocket
        const wsService = req.app.get('wsService');
        if (wsService) {
            wsService.handleStartSession(
                { role: 'teacher', userId: teacherId },
                { sessionId, teacherId }
            );
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error starting session:', error);
        res.status(500).json({ error: 'Failed to start session' });
    }
});

// Join a session
router.post('/sessions/:sessionId/join', isAuthenticated, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = req.session.userId || req.user?.id;
        
        // Record participation
        await req.db.query(`
            INSERT INTO our_session_participants (session_id, user_id)
            VALUES ($1, $2)
            ON CONFLICT (session_id, user_id) 
            DO UPDATE SET joined_at = NOW(), is_active = true
        `, [sessionId, userId]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error joining session:', error);
        res.status(500).json({ error: 'Failed to join session' });
    }
});

// Search for students (teachers only)
router.get('/search-students', isTeacher, async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q || q.length < 2) {
            return res.json([]);
        }
        
        const result = await req.db.query(`
            SELECT id, username, email 
            FROM our_users 
            WHERE (is_teacher = false OR is_teacher IS NULL)
                AND is_active = true
                AND (username ILIKE $1 OR email ILIKE $1)
            ORDER BY username
            LIMIT 20
        `, [`%${q}%`]);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error searching students:', error);
        res.status(500).json({ error: 'Failed to search students' });
    }
});

// Remove student from class (teachers only)
router.delete('/classes/:classId/members/:studentId', isTeacher, async (req, res) => {
    try {
        const { classId, studentId } = req.params;
        const teacherId = req.session.userId || req.user?.id;
        
        // Verify teacher owns the class
        const classCheck = await req.db.query(
            'SELECT 1 FROM our_classes WHERE id = $1 AND teacher_id = $2',
            [classId, teacherId]
        );
        
        if (classCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Remove student
        await req.db.query(
            'DELETE FROM our_class_members WHERE class_id = $1 AND student_id = $2',
            [classId, studentId]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error removing student:', error);
        res.status(500).json({ error: 'Failed to remove student' });
    }
});

// Join class with code (students)
router.post('/join-class', isAuthenticated, async (req, res) => {
    try {
        const { code } = req.body;
        const studentId = req.session.userId || req.user?.id;
        
        // Extract class ID from code (format: KLS-0001)
        const match = code.match(/^KLS-(\d+)$/);
        if (!match) {
            return res.status(400).json({ error: 'Ungültiger Klassencode' });
        }
        
        const classId = parseInt(match[1]);
        
        // Check if class exists
        const classCheck = await req.db.query(
            'SELECT name FROM our_classes WHERE id = $1',
            [classId]
        );
        
        if (classCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Klasse nicht gefunden' });
        }
        
        // Add student to class
        await req.db.query(`
            INSERT INTO our_class_members (class_id, student_id)
            VALUES ($1, $2)
            ON CONFLICT (class_id, student_id) DO NOTHING
        `, [classId, studentId]);
        
        res.json({ 
            success: true, 
            className: classCheck.rows[0].name 
        });
    } catch (error) {
        console.error('Error joining class:', error);
        res.status(500).json({ error: 'Fehler beim Beitreten zur Klasse' });
    }
});

// Track navigation (teachers only)
router.post('/track-navigation', isTeacher, async (req, res) => {
    try {
        const { sessionId, pageType, pageUrl, pageData } = req.body;
        const teacherId = req.session.userId || req.user?.id;
        
        await req.db.query(`
            INSERT INTO our_teacher_navigation 
            (session_id, teacher_id, page_type, page_url, page_data)
            VALUES ($1, $2, $3, $4, $5)
        `, [sessionId, teacherId, pageType, pageUrl, pageData]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error tracking navigation:', error);
        res.status(500).json({ error: 'Failed to track navigation' });
    }
});

module.exports = router;