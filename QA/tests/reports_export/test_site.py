import pytest
import os
from PyPDF2 import PdfReader
from playwright.sync_api import Page, expect
from utils.factories import ProjectFactory, PlotFactory, WorkFactory, JobFactory, ReportFactory

pytestmark = pytest.mark.reports_export

@pytest.fixture
def site_project(project_creator, project_manager):
    project = ProjectFactory.create(name="Site Export Project", creator=project_creator, pm=project_manager)
    plot1 = PlotFactory.create(project=project, name="Site Plot 1")
    work1 = WorkFactory.create(plot=plot1, name="Site Work 1")
    job1 = JobFactory.create(work=work1, name="Site Job 1")
    
    ReportFactory.create(job=job1, reporter=project_manager, description="Site Report A", status="approved")
    ReportFactory.create(job=job1, reporter=project_manager, description="Site Report B", status="approved")
    return project

def test_site_report_generation(auth_page_creator: Page, base_url: str, site_project):
    page = auth_page_creator
    page.goto(f"{base_url}/projects/{site_project.id}")
    
    with page.expect_download() as download_info:
        page.get_by_role("button", name="Export").click()
        page.get_by_role("menuitem", name="Site Report (PDF)").click()
        
    download = download_info.value
    path = download.path()
    assert download.suggested_filename.endswith(".pdf")
    
    reader = PdfReader(path)
    text = ""
    for p in reader.pages:
        text += p.extract_text()
        
    assert "Site Export Project" in text
    assert "Site Report A" in text
    assert "Site Report B" in text

def test_site_report_plot_level(auth_page_creator: Page, base_url: str, site_project):
    page = auth_page_creator
    plot = site_project.plots.first()
    page.goto(f"{base_url}/plots/{plot.id}")
    
    with page.expect_download() as download_info:
        page.get_by_role("button", name="Export").click()
        page.get_by_role("menuitem", name="Site Report (PDF)").click()
        
    download = download_info.value
    path = download.path()
    reader = PdfReader(path)
    text = ""
    for p in reader.pages:
        text += p.extract_text()
        
    assert "Site Plot 1" in text
    assert "Site Report A" in text

def test_site_report_work_level(auth_page_creator: Page, base_url: str, site_project):
    page = auth_page_creator
    work = site_project.plots.first().works.first()
    page.goto(f"{base_url}/works/{work.id}")
    
    with page.expect_download() as download_info:
        page.get_by_role("button", name="Export").click()
        page.get_by_role("menuitem", name="Site Report (PDF)").click()
        
    download = download_info.value
    path = download.path()
    reader = PdfReader(path)
    text = ""
    for p in reader.pages:
        text += p.extract_text()
        
    assert "Site Work 1" in text
    assert "Site Report A" in text

def test_site_report_date_filtering(auth_page_creator: Page, base_url: str, site_project):
    page = auth_page_creator
    page.goto(f"{base_url}/reports")
    
    page.get_by_label("Start Date").fill("2026-01-01")
    page.get_by_label("End Date").fill("2026-12-31")
    
    with page.expect_download() as download_info:
        page.get_by_role("button", name="Export PDF").click()
        
    download = download_info.value
    path = download.path()
    
    reader = PdfReader(path)
    text = ""
    for p in reader.pages:
        text += p.extract_text()
        
    assert "Site Report A" in text
