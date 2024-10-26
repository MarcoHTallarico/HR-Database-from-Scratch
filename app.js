const express = require('express');
const oracledb = require('oracledb');
const bodyParser = require('body-parser');
const config = require('./config'); // Ensure this file contains your DB connection details
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Function to extract relevant error message
function extractRelevantErrorMessage(errorMessage) {
    const regex = /ORA-\d{5}:[^]+?(?=ORA-\d{5}:|$)/;
    const match = errorMessage.match(regex);
    return match ? match[0] : errorMessage;
}

// Home route
app.get('/', (req, res) => {
    res.render('index');
});

// Employee hiring route
app.get('/employee_hiring', (req, res) => {
    res.render('employee_hiring');
});

// Update employee route
app.get('/update_employee', (req, res) => {
    res.render('update_employee');
});

// About page route
app.get('/about', (req, res) => {
    res.render('about');
});

// Search employee route
app.get('/search_employee', (req, res) => {
    res.render('search_employee');
});

// JobBoard page route
app.get('/jobboard', (req, res) => {
    res.render('jobboard');
});

// Route to fetch jobs
app.get('/jobs', async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection(config);
        const result = await connection.execute('SELECT job_id, job_title FROM HR_jobs');
        res.json({ jobs: result.rows.map(row => ({ job_id: row[0], job_title: row[1] })) });
    } catch (err) {
        console.error('Error fetching jobs:', err);
        res.status(500).send('Error fetching jobs');
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('Error closing connection:', err);
            }
        }
    }
});

// Route to fetch job details
app.get('/jobDetails/:jobId', async (req, res) => {
    const jobId = req.params.jobId;
    let connection;
    try {
        connection = await oracledb.getConnection(config);
        const result = await connection.execute(
            'SELECT manager_id, department_id FROM HR_employees WHERE job_id = :jobId',
            [jobId]
        );
        if (result.rows.length > 0) {
            const [manager_id, department_id] = result.rows[0];
            res.json({ manager_id, department_id });
        } else {
            res.status(404).send('Job not found');
        }
    } catch (err) {
        console.error('Error fetching job details:', err);
        res.status(500).send('Error fetching job details');
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('Error closing connection:', err);
            }
        }
    }
});
// Route to hire employee using the stored procedure
app.post('/hire_employee', async (req, res) => {
    const { firstName, lastName, email, phone, hireDate, salary, jobId, managerId, departmentId } = req.body;
    let connection;
    try {
        connection = await oracledb.getConnection(config);
        await connection.execute(
            `BEGIN Employee_hire_sp(:firstName, :lastName, :email, :salary, TO_DATE(:hireDate, 'YYYY-MM-DD'), :phone, :jobId, :managerId, :departmentId); END;`,
            {
                firstName,
                lastName,
                email,
                salary,
                hireDate,
                phone,
                jobId,
                managerId,
                departmentId
            }
        );
        res.json({ message: 'Employee hired successfully!' });
    } catch (err) {
        console.error('Error hiring employee:', err);
        const extractedMessage = extractRelevantErrorMessage(err.message);
        res.status(500).json({ message: `Error hiring employee: ${extractedMessage}` });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('Error closing connection:', err);
            }
        }
    }
});


// Route to fetch all employees
app.get('/all_employees', async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection(config);
        const result = await connection.execute(
            'SELECT employee_id, first_name, last_name, email, phone_number, salary FROM HR_employees'
        );
        res.json({ employees: result.rows });
    } catch (err) {
        console.error('Error fetching employees:', err);
        res.status(500).send('Error fetching employees');
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('Error closing connection:', err);
            }
        }
    }
});

// Route to update employee info
app.post('/update_employee_info', async (req, res) => {
    const { employeeId, email, phone, salary } = req.body;
    let connection;
    try {
        connection = await oracledb.getConnection(config);
        await connection.execute(
            `BEGIN Employee_update_sp(:employeeId, :email, :phone, :salary); END;`,
            {
                employeeId,
                email,
                phone,
                salary
            }
        );
        res.json({ message: 'Employee updated successfully!' });
    } catch (err) {
        console.error('Error updating employee:', err);
        const extractedMessage = extractRelevantErrorMessage(err.message);
        res.status(500).json({ message: `Error updating employee: ${extractedMessage}` });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('Error closing connection:', err);
            }
        }
    }
});

// Route to terminate employee
app.post('/terminate_employee', async (req, res) => {
    const { employeeId } = req.body;
    let connection;
    try {
        connection = await oracledb.getConnection(config);
        await connection.execute(
            `BEGIN Employee_delete_sp(:employeeId); END;`,
            { employeeId }
        );
        res.json({ message: 'Employee terminated successfully!' });
    } catch (err) {
        console.error('Error terminating employee:', err);
        res.status(500).send(`Error terminating employee: ${err.message}`);
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('Error closing connection:', err);
            }
        }
    }
});

// Search employee endpoint
app.post('/search_employee', async (req, res) => {
    const { searchTerm } = req.body;
    let connection;
    try {
        connection = await oracledb.getConnection(config);
        const result = await connection.execute(
            `SELECT employee_id, first_name, last_name, email, phone_number, salary 
             FROM HR_employees 
             WHERE LOWER(first_name) LIKE :searchTerm OR LOWER(last_name) LIKE :searchTerm OR TO_CHAR(employee_id) = :searchTerm`,
            { searchTerm: `%${searchTerm.toLowerCase()}%` }
        );
        res.json({ results: result.rows });
    } catch (err) {
        console.error('Error searching employees:', err);
        res.status(500).send('Error searching employees');
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('Error closing connection:', err);
            }
        }
    }
});


// Route to fetch job details for JobBoard
app.get('/jobBoardDetails/:jobId', async (req, res) => {
    const jobId = req.params.jobId;
    let connection;
    try {
        connection = await oracledb.getConnection(config);
        const result = await connection.execute(
            'SELECT job_id, job_title, min_salary, max_salary FROM HR_jobs WHERE job_id = :jobId',
            [jobId]
        );
        if (result.rows.length > 0) {
            const [job_id, job_title, min_salary, max_salary] = result.rows[0];
            res.json({ job_id, job_title, min_salary, max_salary });
        } else {
            res.status(404).send('Job not found');
        }
    } catch (err) {
        console.error('Error fetching job details:', err);
        res.status(500).send('Error fetching job details');
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('Error closing connection:', err);
            }
        }
    }
});

// Route to update job info for JobBoard
app.post('/update_jobBoard_info', async (req, res) => {
    const { jobId, jobTitle, minSalary, maxSalary } = req.body;
    let connection;
    try {
        connection = await oracledb.getConnection(config);
        await connection.execute(
            `BEGIN update_job(:jobId, :jobTitle, :minSalary, :maxSalary); END;`,
            {
                jobId,
                jobTitle,
                minSalary,
                maxSalary
            }
        );
        res.json({ message: 'Job updated successfully!' });
    } catch (err) {
        console.error('Error updating job:', err);
        res.status(500).send(`Error updating job: ${err.message}`);
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('Error closing connection:', err);
            }
        }
    }
});

// Route to create a new job
app.post('/create_job', async (req, res) => {
    const { jobId, jobTitle, minSalary } = req.body;
    console.log('Received create job request with data:', { jobId, jobTitle, minSalary }); // Debug log

    let connection;
    try {
        connection = await oracledb.getConnection(config);
        console.log('Connected to the database'); // Debug log

        await connection.execute(
            `BEGIN new_job(:jobId, :jobTitle, :minSalary); END;`,
            {
                jobId,
                jobTitle,
                minSalary
            }
        );

        console.log('Job created successfully in the database'); // Debug log
        res.json({ message: 'Job created successfully!' });
    } catch (err) {
        console.error('Error creating job:', err); // Detailed error logging
        res.status(500).send(`Error creating job: ${err.message}`);
    } finally {
        if (connection) {
            try {
                await connection.close();
                console.log('Database connection closed'); // Debug log
            } catch (err) {
                console.error('Error closing connection:', err);
            }
        }
    }
});
// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
