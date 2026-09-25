"""Initial migration - all CareerAI tables

Revision ID: 0001_initial
Revises: 
Create Date: 2024-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0001_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Users
    op.create_table('users',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('full_name', sa.String(255)),
        sa.Column('email', sa.String(320), nullable=False, unique=True),
        sa.Column('password_hash', sa.String(255)),
        sa.Column('auth_provider', sa.Enum('email', 'google', name='authprovider'), default='email'),
        sa.Column('google_subject_id', sa.String(255), unique=True),
        sa.Column('email_verified', sa.Boolean, default=False, nullable=False),
        sa.Column('role', sa.Enum('user', 'admin', name='userrole'), default='user', nullable=False),
        sa.Column('is_active', sa.Boolean, default=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('last_login_at', sa.DateTime(timezone=True)),
    )
    op.create_index('ix_users_email', 'users', ['email'])

    # Email verification tokens
    op.create_table('email_verification_tokens',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('token_hash', sa.String(255), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('attempts', sa.Integer, default=0, nullable=False),
        sa.Column('used_at', sa.DateTime(timezone=True)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_email_verification_user_id', 'email_verification_tokens', ['user_id'])

    # Password reset tokens
    op.create_table('password_reset_tokens',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('token_hash', sa.String(255), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used_at', sa.DateTime(timezone=True)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Sessions
    op.create_table('sessions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('refresh_token_hash', sa.String(255), nullable=False),
        sa.Column('user_agent', sa.String(512)),
        sa.Column('ip_hash', sa.String(64)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('last_seen_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('revoked_at', sa.DateTime(timezone=True)),
    )
    op.create_index('ix_sessions_user_id', 'sessions', ['user_id'])
    op.create_index('ix_sessions_refresh_token_hash', 'sessions', ['refresh_token_hash'])

    # Security events
    op.create_table('security_events',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL')),
        sa.Column('event_type', sa.String(64), nullable=False),
        sa.Column('severity', sa.Enum('low','medium','high','critical', name='securityeventseverity'), default='low'),
        sa.Column('ip_hash', sa.String(64)),
        sa.Column('user_agent', sa.String(512)),
        sa.Column('metadata', sa.JSON),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_security_events_user_id', 'security_events', ['user_id'])
    op.create_index('ix_security_events_event_type', 'security_events', ['event_type'])
    op.create_index('ix_security_events_created_at', 'security_events', ['created_at'])

    # Resumes
    op.create_table('resumes',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('filename', sa.String(255), nullable=False),
        sa.Column('storage_key', sa.String(512), nullable=False, unique=True),
        sa.Column('file_size', sa.BigInteger, nullable=False),
        sa.Column('file_hash', sa.String(64), nullable=False),
        sa.Column('parsed_text', sa.Text),
        sa.Column('metadata', sa.JSON),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('deleted_at', sa.DateTime(timezone=True)),
    )
    op.create_index('ix_resumes_user_id', 'resumes', ['user_id'])

    # Job descriptions
    op.create_table('job_descriptions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('company', sa.String(255)),
        sa.Column('content', sa.Text, nullable=False),
        sa.Column('source', sa.String(255)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_jd_user_id', 'job_descriptions', ['user_id'])

    # Skills
    op.create_table('skills',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(128), nullable=False, unique=True),
        sa.Column('category', sa.String(64)),
    )
    op.create_index('ix_skills_name', 'skills', ['name'])

    # Resume skills
    op.create_table('resume_skills',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('resume_id', sa.String(36), sa.ForeignKey('resumes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('skill_id', sa.String(36), sa.ForeignKey('skills.id', ondelete='CASCADE'), nullable=False),
        sa.Column('evidence', sa.Text),
        sa.Column('confidence', sa.Float, default=1.0),
    )

    # JD skills
    op.create_table('jd_skills',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('job_description_id', sa.String(36), sa.ForeignKey('job_descriptions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('skill_id', sa.String(36), sa.ForeignKey('skills.id', ondelete='CASCADE'), nullable=False),
        sa.Column('importance', sa.Enum('required','preferred','nice_to_have', name='skillimportance'), default='required'),
        sa.Column('evidence', sa.Text),
    )

    # Analyses
    op.create_table('analyses',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('resume_id', sa.String(36), sa.ForeignKey('resumes.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('job_description_id', sa.String(36), sa.ForeignKey('job_descriptions.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('status', sa.Enum('queued','processing','completed','failed','cancelled', name='analysisstatus'), default='queued', nullable=False),
        sa.Column('overall_score', sa.Float),
        sa.Column('error_message', sa.Text),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('completed_at', sa.DateTime(timezone=True)),
    )
    op.create_index('ix_analyses_user_id', 'analyses', ['user_id'])
    op.create_index('ix_analyses_status', 'analyses', ['status'])
    op.create_index('ix_analyses_created_at', 'analyses', ['created_at'])

    # Analysis skills
    op.create_table('analysis_skills',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('analysis_id', sa.String(36), sa.ForeignKey('analyses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('skill_id', sa.String(36), sa.ForeignKey('skills.id', ondelete='CASCADE'), nullable=False),
        sa.Column('match_status', sa.Enum('matched','partial','missing','related', name='skillmatchstatus'), nullable=False),
        sa.Column('similarity_score', sa.Float),
        sa.Column('evidence', sa.Text),
    )

    # Analysis results
    op.create_table('analysis_results',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('analysis_id', sa.String(36), sa.ForeignKey('analyses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('section', sa.String(64), nullable=False),
        sa.Column('result_json', sa.JSON, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('analysis_id', 'section', name='uq_analysis_section'),
    )

    # Interviews
    op.create_table('interviews',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('analysis_id', sa.String(36), sa.ForeignKey('analyses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('type', sa.Enum('technical','hr', name='interviewtype'), nullable=False),
        sa.Column('question', sa.Text, nullable=False),
        sa.Column('answer', sa.Text),
        sa.Column('explanation', sa.Text),
        sa.Column('difficulty', sa.String(16)),
        sa.Column('topic', sa.String(128)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_interviews_analysis_id', 'interviews', ['analysis_id'])

    # Roadmap items
    op.create_table('roadmap_items',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('analysis_id', sa.String(36), sa.ForeignKey('analyses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('week', sa.Integer, nullable=False),
        sa.Column('skill', sa.String(128), nullable=False),
        sa.Column('topic', sa.String(255), nullable=False),
        sa.Column('objective', sa.Text),
        sa.Column('practice_task', sa.Text),
        sa.Column('project_task', sa.Text),
    )

    # Project recommendations
    op.create_table('project_recommendations',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('analysis_id', sa.String(36), sa.ForeignKey('analyses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('reason', sa.Text),
        sa.Column('skills', sa.JSON),
        sa.Column('technology', sa.JSON),
        sa.Column('difficulty', sa.String(32)),
        sa.Column('learning_outcome', sa.Text),
        sa.Column('resume_bullet', sa.Text),
    )


def downgrade() -> None:
    for table in [
        'project_recommendations', 'roadmap_items', 'interviews',
        'analysis_results', 'analysis_skills', 'analyses',
        'jd_skills', 'resume_skills', 'skills',
        'job_descriptions', 'resumes',
        'security_events', 'sessions',
        'password_reset_tokens', 'email_verification_tokens', 'users',
    ]:
        op.drop_table(table)
    for enum in [
        'authprovider', 'userrole', 'analysisstatus', 'skillmatchstatus',
        'securityeventseverity', 'interviewtype', 'skillimportance',
    ]:
        sa.Enum(name=enum).drop(op.get_bind())
