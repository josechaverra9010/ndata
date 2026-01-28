import asyncio
from storage_utils import storage_manager

async def test_gcs():
    try:
        print(f"Testing GCS upload...")
        print(f"Bucket: {storage_manager.bucket_name}")
        print(f"Project: {storage_manager.project_id}")
        
        result = await storage_manager.save_file(
            file_content=b'test content',
            filename='test_gcs.txt',
            content_type='text/plain'
        )
        print(f"✅ Result: {result}")
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_gcs())
